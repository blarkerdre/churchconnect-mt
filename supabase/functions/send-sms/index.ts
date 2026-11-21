import { senderNameFrom } from "../_shared/sms-sender.ts";
import { callerMfaSatisfied, cleanMessageText, phoneKey, loadLeaderUnits, memberInUnits, smsContentProblem, tenantSuspended, SUSPENDED_MESSAGE, NON_ADMIN_DAILY_SMS_LIMIT, smsSentBySenderLastDay, phonesAlreadySentMessage } from "../_shared/sender-guard.ts";
import { loadTenantPhoneSet, isTenantPhone } from "../_shared/tenant-phones.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkSmsQuota, QuotaExceededError } from "../_shared/sms-quota.ts";
import { writeAudit } from "../_shared/audit.ts";
import { validateOutboundUrl, validateMethod } from "../_shared/url-validator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TWILIO_GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const AT_SMS_URL = "https://api.africastalking.com/version1/messaging";
const TERMII_SMS_URL = "https://api.ng.termii.com/api/sms/send";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY") || Deno.env.get("TWILIO_API_KEY_1");
    if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured");

    const TWILIO_FROM = Deno.env.get("TWILIO_FROM_NUMBER");
    if (!TWILIO_FROM) throw new Error("TWILIO_FROM_NUMBER is not configured");

    // Validate sender number is E.164
    function validateE164(num: string, label: string): void {
      const cleaned = num.replace(/[\s\-\(\)\.]/g, "");
      if (!/^\+[1-9]\d{6,14}$/.test(cleaned)) {
        throw new Error(`${label} "${num}" is not a valid E.164 phone number. Expected format: +1234567890`);
      }
    }
    validateE164(TWILIO_FROM, "TWILIO_FROM_NUMBER");

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Allow trusted internal callers (other edge functions / cron) to bypass
    // the user-auth check by presenting the service-role key as bearer.
    const bearer = authHeader.slice(7).trim();
    const isInternalServiceCall = bearer === serviceRoleKey;

    let userId: string | null = null;
    if (!isInternalServiceCall) {
      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
      if (!(await callerMfaSatisfied(supabaseUrl, supabaseKey, authHeader))) {
        return new Response(JSON.stringify({ error: "Two-step verification is required to send messages" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();
    const { recipients, sms_type, reference_id, channel, tenant_id } = body;
    const message = cleanMessageText(body.message);
    // When set, the caller may only message these phone keys (non-admins).
    let restrictedPhoneKeys: Set<string> | null = null;
    // Internal callers send system-composed texts; signed-in callers are bounded below.
    let senderIsAdmin = isInternalServiceCall;

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service client for tenant-scoped auth checks
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    if (!isInternalServiceCall) {
      // Verify user belongs to this tenant
      const { data: belongsToTenant } = await serviceClient.rpc("user_belongs_to_tenant", {
        _user_id: userId,
        _tenant_id: tenant_id,
      });
      if (!belongsToTenant) {
        return new Response(JSON.stringify({ error: "Forbidden: not a member of this tenant" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // A suspended church can't send texts until billing is sorted
      // (platform super-admins excepted). The app hides sending, but this
      // function can be called directly.
      const { data: callerIsSuper } = await serviceClient.rpc("has_role", { _user_id: userId, _role: "super_admin" });
      if (callerIsSuper !== true && (await tenantSuspended(serviceClient, tenant_id))) {
        return new Response(JSON.stringify({ error: SUSPENDED_MESSAGE }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check tenant-scoped admin or unit_leader role
      const { data: isAdmin } = await serviceClient.rpc("is_admin", { _user_id: userId, _tenant_id: tenant_id });
      senderIsAdmin = isAdmin === true;
      const { data: isLeader } = await serviceClient.rpc("has_role", {
        _user_id: userId,
        _role: "unit_leader",
        _tenant_id: tenant_id,
      });

      if (!isAdmin && isLeader) {
        // Unit leaders may only text members of the units they lead, plus the
        // person a follow-up is about.
        const units = await loadLeaderUnits(serviceClient, userId!, tenant_id);
        restrictedPhoneKeys = new Set<string>();
        if (units.length > 0) {
          const { data: unitMembers } = await serviceClient
            .from("members")
            .select("phone, church_unit")
            .eq("tenant_id", tenant_id)
            .not("phone", "is", null)
            .limit(20000);
          for (const m of unitMembers || []) {
            if (memberInUnits(m.church_unit, units)) {
              const k = phoneKey(m.phone);
              if (k.length >= 7) restrictedPhoneKeys.add(k);
            }
          }
        }
        if ((sms_type === "followup" || (body as any).reference_type === "followup") && reference_id) {
          const { data: fu } = await serviceClient
            .from("followups")
            .select("member_id")
            .eq("id", reference_id)
            .eq("tenant_id", tenant_id)
            .maybeSingle();
          if (fu?.member_id) {
            const { data: person } = await serviceClient
              .from("members")
              .select("phone")
              .eq("id", fu.member_id)
              .eq("tenant_id", tenant_id)
              .maybeSingle();
            const k = phoneKey(person?.phone);
            if (k.length >= 7) restrictedPhoneKeys.add(k);
          }
        }
        if (restrictedPhoneKeys.size === 0) {
          return new Response(JSON.stringify({ error: "Forbidden: you can only message members of the units you lead" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      if (!isAdmin && !isLeader) {
        // Allow Follow-up unit members to send SMS for their own followups only.
        const isFollowupContext =
          (sms_type === "followup" || (body as any).reference_type === "followup") &&
          !!reference_id &&
          Array.isArray(recipients) &&
          recipients.length === 1;

        let allowedAsFollowupMember = false;
        if (isFollowupContext) {
          const { data: isFollowupMember } = await serviceClient.rpc(
            "user_is_followup_unit_member",
            { _user_id: userId, _tenant_id: tenant_id }
          );
          if (isFollowupMember) {
            const { data: followupRow } = await serviceClient
              .from("followups")
              .select("id, tenant_id, assigned_to, created_by, member_id")
              .eq("id", reference_id)
              .eq("tenant_id", tenant_id)
              .maybeSingle();
            if (
              followupRow &&
              followupRow.member_id &&
              (followupRow.assigned_to === userId || followupRow.created_by === userId)
            ) {
              // The single recipient must be the person this follow-up is about.
              const { data: personRow } = await serviceClient
                .from("members")
                .select("phone, emergency_contact_phone")
                .eq("id", followupRow.member_id)
                .eq("tenant_id", tenant_id)
                .maybeSingle();
              const digits = (p: unknown) => String(p || "").replace(/\D/g, "").slice(-9);
              const target = digits(recipients[0]?.phone);
              const personPhones = [personRow?.phone, personRow?.emergency_contact_phone]
                .map(digits)
                .filter((d) => d.length >= 7);
              if (target.length >= 7 && personPhones.includes(target)) {
                allowedAsFollowupMember = true;
              }
            }
          }
        }

        if (!allowedAsFollowupMember) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Bound message content and fan-out for every caller.
    if (typeof message !== "string" || !message.trim() || message.length > 1600) {
      return new Response(JSON.stringify({ error: "Message must be 1-1600 characters" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(recipients) || recipients.length === 0 || recipients.length > 500) {
      return new Response(JSON.stringify({ error: "Between 1 and 500 recipients are allowed per request" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Non-admin senders (unit leaders, follow-up workers) have a personal
    // 24-hour cap on top of the church's own monthly limit.
    if (!isInternalServiceCall && !senderIsAdmin) {
      const sentToday = await smsSentBySenderLastDay(serviceClient, userId!, tenant_id);
      if (sentToday + recipients.length > NON_ADMIN_DAILY_SMS_LIMIT) {
        return new Response(JSON.stringify({
          error: `You can send up to ${NON_ADMIN_DAILY_SMS_LIMIT} messages a day. Ask a church admin to send larger messages.`,
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const msgChannel = channel === "whatsapp" ? "whatsapp" : "sms";

    // Resolve per-tenant settings and provider
    let fromNumber = TWILIO_FROM;
    let tenantWhatsappFrom: string | null = null;
    let smsProvider = "twilio";
    let tenantSettings: Record<string, unknown> = {};
    {
      const { data: tenantRow } = await serviceClient
        .from("tenants")
        .select("settings")
        .eq("id", tenant_id)
        .single();
      if (tenantRow?.settings) {
        tenantSettings = tenantRow.settings as Record<string, unknown>;
        smsProvider = (tenantSettings.sms_provider as string) || "twilio";
        if (msgChannel === "sms" && tenantSettings.twilio_sms_from) {
          const tenantFrom = tenantSettings.twilio_sms_from as string;
          try { validateE164(tenantFrom, "Tenant SMS sender"); } catch { /* fall back to default */ }
          if (/^\+[1-9]\d{6,14}$/.test(tenantFrom.replace(/[\s\-\(\)\.]/g, ""))) {
            fromNumber = tenantFrom;
          }
        }
        if (tenantSettings.twilio_whatsapp_from) {
          tenantWhatsappFrom = tenantSettings.twilio_whatsapp_from as string;
        }
      }
    }

    // For WhatsApp, always use Twilio
    if (msgChannel === "whatsapp") {
      smsProvider = "twilio";
      const waFromRaw = tenantWhatsappFrom || Deno.env.get("TWILIO_WHATSAPP_FROM");
      if (!waFromRaw) throw new Error("TWILIO_WHATSAPP_FROM is not configured");
      const waFrom = waFromRaw.replace(/\s/g, "");
      fromNumber = waFrom.startsWith("whatsapp:") ? waFrom : `whatsapp:${waFrom}`;
    }

    // Fetch provider credentials for non-Twilio providers
    let providerCreds: Record<string, string> = {};
    if (smsProvider !== "twilio") {
      const credKeys = smsProvider === "africastalking"
        ? ["africastalking_api_key", "africastalking_username", "africastalking_sender_id"]
        : ["termii_api_key", "termii_sender_id"];
      const { data: credData } = await serviceClient
        .from("app_settings")
        .select("key, value")
        .eq("tenant_id", tenant_id)
        .in("key", credKeys);
      (credData || []).forEach((r: any) => { providerCreds[r.key] = r.value || ""; });
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return new Response(JSON.stringify({ error: "No recipients provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Quota enforcement (shared helper) ──
    const quotaResult = await checkSmsQuota(serviceClient, tenant_id, msgChannel as any, recipients.length);
    const quota = quotaResult.limit;
    let currentUsage = quotaResult.usage;
    if (!quotaResult.allowed) {
      return new Response(
        JSON.stringify({
          error: `${msgChannel === "whatsapp" ? "WhatsApp" : "SMS"} quota exceeded. ${quotaResult.remaining} messages remaining this month (limit: ${quotaResult.limit}).`,
          remaining: quotaResult.remaining,
          limit: quotaResult.limit,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isInternalServiceCall) {
      const problem = smsContentProblem(message, senderIsAdmin);
      if (problem) {
        return new Response(JSON.stringify({ error: problem }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (message.length > 1600) {
      return new Response(JSON.stringify({ error: "Message too long (max 1600 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // E.164 normalization helper
    function normalizeE164(phone: string): string | null {
      let cleaned = phone.replace(/[\s\-\(\)\.]/g, "");
      if (/^0[1-9]\d{9,10}$/.test(cleaned)) {
        cleaned = "+44" + cleaned.slice(1);
      }
      if (!cleaned.startsWith("+")) cleaned = "+" + cleaned;
      return /^\+[1-9]\d{6,14}$/.test(cleaned) ? cleaned : null;
    }

    let sent = 0;
    let failed = 0;
    const logs: any[] = [];

    // Build the webhook URL for delivery status callbacks
    const webhookUrl = `${supabaseUrl}/functions/v1/twilio-webhook`;

    const allowedPhones = await loadTenantPhoneSet(serviceClient, tenant_id);

    // People-written texts: never send the exact same message to the same
    // person twice within 24 hours (stops repeat blasts at members).
    let alreadySent = new Set<string>();
    let skippedRepeat = 0;
    if (!isInternalServiceCall) {
      const candidatePhones = recipients
        .map((r: any) => normalizeE164(String(r?.phone || "").trim()))
        .filter((p: string | null): p is string => !!p);
      alreadySent = await phonesAlreadySentMessage(serviceClient, tenant_id, message, candidatePhones);
    }
    const seenThisBatch = new Set<string>();

    for (const recipient of recipients) {
      let normalized = normalizeE164(recipient.phone?.trim() || "");
      if (normalized && !isInternalServiceCall) {
        if (alreadySent.has(normalized) || seenThisBatch.has(normalized)) {
          skippedRepeat++;
          continue;
        }
        seenThisBatch.add(normalized);
      }
      // Only message numbers already recorded for this church.
      if (normalized && !isTenantPhone(allowedPhones, normalized)) normalized = null;
      if (normalized && restrictedPhoneKeys && !restrictedPhoneKeys.has(phoneKey(normalized))) normalized = null;
      if (!normalized) {
        failed++;
        logs.push({
          sender_id: userId,
          recipient_phone: recipient.phone || "invalid",
          recipient_member_id: recipient.member_id || null,
          message,
          sms_type: sms_type || "bulk",
          reference_id: reference_id || null,
          status: "failed",
          channel: msgChannel,
          error_message: "Invalid number, or not a number you are allowed to message",
          ...(tenant_id ? { tenant_id } : {}),
        });
        continue;
      }

      try {
        let data: any = {};
        let response: Response;

        if (smsProvider === "custom") {
          // Custom provider
          const { data: customConfigRow } = await serviceClient
            .from("app_settings")
            .select("value, updated_by")
            .eq("tenant_id", tenant_id)
            .eq("key", "custom_sms_provider_config")
            .maybeSingle();
          const customConfig = customConfigRow?.value as Record<string, string> | null;
          if (!customConfig?.endpoint) throw new Error("Custom SMS provider not configured");
          // Only use a custom text-message provider a platform super-admin set up.
          // Church admins cannot point texts (and members' numbers) at their own address.
          let approved = false;
          if (customConfigRow?.updated_by) {
            const { data: approverIsSuper } = await serviceClient.rpc("has_role", {
              _user_id: customConfigRow.updated_by,
              _role: "super_admin",
            });
            approved = approverIsSuper === true;
          }
          if (!approved) throw new Error("This church's custom text-message provider hasn't been approved by the platform team yet.");

          let bodyStr = (customConfig.body_template || "")
            .replace(/\{\{to\}\}/g, normalized)
            .replace(/\{\{message\}\}/g, message)
            .replace(/\{\{from\}\}/g, customConfig.sender_id || "");

          const headers: Record<string, string> = {};
          if (customConfig.content_type) headers["Content-Type"] = customConfig.content_type;
          if (customConfig.auth_header && customConfig.auth_value) {
            headers[customConfig.auth_header] = customConfig.auth_value;
          }

          const validatedUrl = validateOutboundUrl(customConfig.endpoint);
          const validatedMethod = validateMethod(customConfig.method);
          response = await fetch(validatedUrl.toString(), {
            method: validatedMethod,
            headers,
            body: bodyStr,
            redirect: "manual",
          });
          data = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(`Custom provider error (${response.status}): ${JSON.stringify(data)}`);
          }
          data.sid = data.id || data.message_id || data.sid || null;

        } else if (smsProvider === "africastalking") {
          const atApiKey = providerCreds.africastalking_api_key;
          const atUsername = providerCreds.africastalking_username;
          if (!atApiKey || !atUsername) throw new Error("Africa's Talking credentials not configured");

          const atFrom = providerCreds.africastalking_sender_id || "";
          const params = new URLSearchParams({
            username: atUsername,
            to: normalized,
            message,
            ...(atFrom ? { from: atFrom } : {}),
          });

          response = await fetch(AT_SMS_URL, {
            method: "POST",
            headers: {
              apiKey: atApiKey,
              Accept: "application/json",
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params,
          });
          data = await response.json();
          if (!response.ok) throw new Error(`Africa's Talking error: ${JSON.stringify(data)}`);
          const msgData = data.SMSMessageData?.Recipients?.[0];
          if (msgData?.status === "Success") {
            data.sid = msgData.messageId;
          } else {
            throw new Error(`Africa's Talking: ${msgData?.status || JSON.stringify(data)}`);
          }

        } else if (smsProvider === "termii") {
          const termiiKey = providerCreds.termii_api_key;
          const termiiSender = providerCreds.termii_sender_id || "N-Alert";
          if (!termiiKey) throw new Error("Termii API key not configured");

          response = await fetch(TERMII_SMS_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: termiiKey,
              to: normalized.replace("+", ""),
              from: termiiSender,
              sms: message,
              type: "plain",
              channel: "generic",
            }),
          });
          data = await response.json();
          if (!response.ok || data.code !== "ok") {
            throw new Error(`Termii error: ${data.message || JSON.stringify(data)}`);
          }
          data.sid = data.message_id || null;

        } else {
          // Twilio (default)
          const toNumber = msgChannel === "whatsapp" ? `whatsapp:${normalized}` : normalized;
          let fromForThis = fromNumber;
          const naFrom = (tenantSettings.twilio_sms_from_na as string | undefined)?.replace(/[\s\-\(\)\.]/g, "");
          if (msgChannel === "sms" && normalized.startsWith("+1") && naFrom && /^\+1\d{10}$/.test(naFrom)) {
            fromForThis = naFrom;
          }
          const senderName = msgChannel === "sms" && !normalized.startsWith("+1") ? senderNameFrom(tenantSettings) : null;
          const sendOnce = async (from: string) => fetch(`${TWILIO_GATEWAY_URL}/Messages.json`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": TWILIO_API_KEY,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ To: toNumber, From: from, Body: message, StatusCallback: webhookUrl }),
          });
          response = await sendOnce(senderName || fromForThis);
          data = await response.json();
          if (!response.ok && senderName && [21212, 21612, 21408, 21606, 21659].includes(data?.code)) {
            response = await sendOnce(fromForThis);
            data = await response.json();
          }
          if (!response.ok) {
            if (data?.code === 21612 || data?.code === 21408) {
              throw new Error(`Your sending number can't reach this country (${normalized.slice(0, 3)}...). Add a local sending number for this country in Messaging settings.`);
            }
            throw new Error(data.message || JSON.stringify(data));
          }
        }

        sent++;
        logs.push({
          sender_id: userId,
          recipient_phone: normalized,
          recipient_member_id: recipient.member_id || null,
          message,
          sms_type: sms_type || "bulk",
          reference_id: reference_id || null,
          status: "sent",
          channel: msgChannel,
          message_sid: data.sid || null,
          delivery_status: "queued",
          ...(tenant_id ? { tenant_id } : {}),
        });
      } catch (err) {
        failed++;
        logs.push({
          sender_id: userId,
          recipient_phone: normalized,
          recipient_member_id: recipient.member_id || null,
          message,
          sms_type: sms_type || "bulk",
          reference_id: reference_id || null,
          status: "failed",
          channel: msgChannel,
          error_message: err instanceof Error ? err.message : "Unknown error",
          ...(tenant_id ? { tenant_id } : {}),
        });
      }
    }

    // Log all SMS using service role to bypass RLS
    if (logs.length > 0) {
      await serviceClient.from("sms_log").insert(logs);
    }

    // Audit trail entry (one per dispatch batch)
    await writeAudit(serviceClient, {
      tenant_id,
      user_id: userId,
      action: (channel === "whatsapp" ? "whatsapp_sent" : "sms_sent"),
      entity_type: "sms_log",
      entity_id: reference_id ?? null,
      details: {
        channel: channel || "sms",
        sms_type: sms_type || null,
        recipients_count: recipients.length,
        success_count: sent,
        failed_count: failed,
        skipped_repeat_count: skippedRepeat,
        message_excerpt: message.slice(0, 500),
        source: "send-sms",
      },
    });

    const responseBody: Record<string, unknown> = { sent, failed, total: recipients.length };
    if (skippedRepeat > 0) responseBody.skipped_repeat = skippedRepeat;
    if (quota > 0) {
      responseBody.remaining = Math.max(quota - currentUsage - sent, 0);
      responseBody.limit = quota;
    }

    return new Response(
      JSON.stringify(responseBody),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("send-sms error:", error);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
