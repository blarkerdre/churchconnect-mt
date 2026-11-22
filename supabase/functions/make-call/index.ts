import { loadTenantPhoneSet, isTenantPhone } from "../_shared/tenant-phones.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { validateOutboundUrl, validateMethod } from "../_shared/url-validator.ts";
import { tenantSuspended, featureDisabled, NON_ADMIN_DAILY_CALL_LIMIT, callsByCallerLastDay } from "../_shared/sender-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TWILIO_GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const AT_VOICE_URL = "https://voice.africastalking.com/call";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { recipient_phone, member_id, reference_type, reference_id, tenant_id, notes } = body;

    if (!tenant_id || !recipient_phone) {
      return new Response(JSON.stringify({ error: "tenant_id and recipient_phone are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify tenant membership AND admin/leader role (parity with send-sms)
    const { data: belongs } = await serviceClient.rpc("user_belongs_to_tenant", {
      _user_id: user.id,
      _tenant_id: tenant_id,
    });
    if (!belongs) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: isAdmin }, { data: isLeader }] = await Promise.all([
      serviceClient.rpc("is_admin", { _user_id: user.id, _tenant_id: tenant_id }),
      serviceClient.rpc("has_role", { _user_id: user.id, _role: "unit_leader", _tenant_id: tenant_id }),
    ]);
    if (!isAdmin && !isLeader) {
      // Allow Follow-up unit members to place calls for their own followups only.
      let allowedAsFollowupMember = false;
      if (reference_type === "followup" && reference_id) {
        const { data: isFollowupMember } = await serviceClient.rpc(
          "user_is_followup_unit_member",
          { _user_id: user.id, _tenant_id: tenant_id }
        );
        if (isFollowupMember) {
          const { data: followupRow } = await serviceClient
            .from("followups")
            .select("id, tenant_id, assigned_to, created_by")
            .eq("id", reference_id)
            .eq("tenant_id", tenant_id)
            .maybeSingle();
          if (
            followupRow &&
            (followupRow.assigned_to === user.id || followupRow.created_by === user.id)
          ) {
            allowedAsFollowupMember = true;
          }
        }
      }

      if (!allowedAsFollowupMember) {
        return new Response(JSON.stringify({ error: "Only admins or unit leaders can place calls" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Suspended churches can't place calls (super-admins excepted).
    const { data: isSuper } = await serviceClient.rpc("has_role", { _user_id: user.id, _role: "super_admin" });
    if (!isSuper && await tenantSuspended(serviceClient, tenant_id)) {
      return new Response(JSON.stringify({ error: "This church's account is suspended. Calls can't be placed until billing is sorted out." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isSuper && await featureDisabled(serviceClient, tenant_id, "/phone-call")) {
      return new Response(JSON.stringify({ error: "Phone calls are switched off for this church." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Non-admins get a daily call limit.
    if (!isAdmin && !isSuper) {
      const made = await callsByCallerLastDay(serviceClient, user.id, tenant_id);
      if (made >= NON_ADMIN_DAILY_CALL_LIMIT) {
        return new Response(JSON.stringify({ error: `You've reached today's limit of ${NON_ADMIN_DAILY_CALL_LIMIT} calls. Try again tomorrow or ask a church admin.` }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Call-minute allowance: 0 = unlimited; otherwise need unused minutes or prepaid balance.
    const { data: tq } = await serviceClient.from("tenants")
      .select("call_minutes_limit_monthly, call_minutes_balance").eq("id", tenant_id).maybeSingle();
    const minLimit = Number(tq?.call_minutes_limit_monthly || 0);
    if (minLimit > 0) {
      const { data: usedMin } = await serviceClient.rpc("call_minutes_used", { _tenant_id: tenant_id });
      if (Number(usedMin || 0) >= minLimit && Number(tq?.call_minutes_balance || 0) <= 0) {
        return new Response(JSON.stringify({ error: `This church has used all ${minLimit} call minutes for this billing cycle. Ask the platform team to add more minutes.` }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Normalize phone
    let phone = (recipient_phone || "").replace(/[\s\-\(\)\.]/g, "");
    if (/^0[1-9]\d{9,10}$/.test(phone)) phone = "+44" + phone.slice(1);
    if (!phone.startsWith("+")) phone = "+" + phone;
    if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
      return new Response(JSON.stringify({ error: "Invalid phone number format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only call numbers already recorded for this church.
    const allowedPhones = await loadTenantPhoneSet(serviceClient, tenant_id, { excludeLeaderTyped: !isAdmin && !isSuper });
    if (!isTenantPhone(allowedPhones, phone)) {
      return new Response(JSON.stringify({ error: "This number is not on record for your church" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // A member can only be recorded against the call if they belong to this church.
    let safeMemberId: string | null = null;
    if (member_id) {
      const { data: memberRow } = await serviceClient
        .from("members").select("id").eq("id", member_id).eq("tenant_id", tenant_id).maybeSingle();
      if (!memberRow) {
        return new Response(JSON.stringify({ error: "That member is not part of this church" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      safeMemberId = memberRow.id;
    }

    // Get tenant settings for provider
    const { data: tenantRow } = await serviceClient
      .from("tenants")
      .select("settings")
      .eq("id", tenant_id)
      .single();

    const settings = (tenantRow?.settings || {}) as Record<string, unknown>;
    const voiceProvider = (settings.voice_provider as string) || "twilio";

    let providerCallId: string | null = null;
    let callStatus = "initiated";

    if (voiceProvider === "custom") {
      // Custom voice provider
      const { data: customConfigRow } = await serviceClient
        .from("app_settings")
        .select("value, updated_by")
        .eq("tenant_id", tenant_id)
        .eq("key", "custom_voice_provider_config")
        .maybeSingle();
      const customConfig = customConfigRow?.value as Record<string, string> | null;
      // Only use a custom call provider that a platform super-admin set up.
      // Church admins cannot point calls (and members' numbers) at their own address.
      let approved = false;
      if (customConfigRow?.updated_by) {
        const { data: approverIsSuper } = await serviceClient.rpc("has_role", {
          _user_id: customConfigRow.updated_by,
          _role: "super_admin",
        });
        approved = approverIsSuper === true;
      }
      if (customConfig?.endpoint && !approved) {
        return new Response(JSON.stringify({ error: "This church's custom call provider hasn't been approved by the platform team yet." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!customConfig?.endpoint) {
        return new Response(JSON.stringify({ error: "Custom voice provider not configured" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let bodyStr = (customConfig.body_template || "")
        .replace(/\{\{to\}\}/g, phone)
        .replace(/\{\{from\}\}/g, customConfig.sender_id || "");

      const headers: Record<string, string> = {};
      if (customConfig.content_type) headers["Content-Type"] = customConfig.content_type;
      if (customConfig.auth_header && customConfig.auth_value) {
        headers[customConfig.auth_header] = customConfig.auth_value;
      }

      let validatedUrl: URL;
      let validatedMethod: string;
      try {
        validatedUrl = validateOutboundUrl(customConfig.endpoint);
        validatedMethod = validateMethod(customConfig.method);
      } catch (e) {
        return new Response(
          JSON.stringify({ error: `Custom voice provider rejected: ${e instanceof Error ? e.message : "invalid configuration"}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const response = await fetch(validatedUrl.toString(), {
        method: validatedMethod,
        headers,
        body: bodyStr,
        redirect: "manual",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(`Custom voice provider error (${response.status}): ${JSON.stringify(data)}`);
      }
      providerCallId = data.id || data.call_id || data.sid || null;
      callStatus = "initiated";

    } else if (voiceProvider === "africastalking") {
      // Africa's Talking voice call
      const { data: atSettings } = await serviceClient
        .from("app_settings")
        .select("value")
        .eq("tenant_id", tenant_id)
        .in("key", ["africastalking_api_key", "africastalking_username"]);

      const atApiKey = atSettings?.find((s: any) => s.key === "africastalking_api_key")?.value;
      const atUsername = atSettings?.find((s: any) => s.key === "africastalking_username")?.value;

      if (!atApiKey || !atUsername) {
        return new Response(JSON.stringify({ error: "Africa's Talking credentials not configured. Please set them in Settings > Comms." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const atFromNumber = (settings.africastalking_voice_from as string) || "";
      const params = new URLSearchParams({
        username: atUsername as string,
        to: phone,
        from: atFromNumber,
      });

      const response = await fetch(AT_VOICE_URL, {
        method: "POST",
        headers: {
          "apiKey": atApiKey as string,
          "Accept": "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Africa's Talking voice error: ${JSON.stringify(data)}`);
      }
      providerCallId = data.entries?.[0]?.id || null;
      callStatus = data.entries?.[0]?.status === "Queued" ? "queued" : "initiated";

    } else {
      // Twilio voice call
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

      const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY") || Deno.env.get("TWILIO_API_KEY_1");
      if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured");

      const TWILIO_FROM = Deno.env.get("TWILIO_FROM_NUMBER");
      if (!TWILIO_FROM) throw new Error("TWILIO_FROM_NUMBER is not configured");

      let fromNumber = TWILIO_FROM;
      if (settings.twilio_sms_from) {
        fromNumber = settings.twilio_sms_from as string;
      }

      const callbackUrl = `${supabaseUrl}/functions/v1/twilio-webhook`;
      const params = new URLSearchParams({
        To: phone,
        From: fromNumber,
        Url: "http://demo.twilio.com/docs/voice.xml",
        StatusCallback: callbackUrl,
        StatusCallbackMethod: "POST",
      });
      // URLSearchParams supports repeated keys via append
      params.append("StatusCallbackEvent", "initiated");
      params.append("StatusCallbackEvent", "ringing");
      params.append("StatusCallbackEvent", "answered");
      params.append("StatusCallbackEvent", "completed");

      const response = await fetch(`${TWILIO_GATEWAY_URL}/Calls.json`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": TWILIO_API_KEY,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Twilio voice error: ${data.message || JSON.stringify(data)}`);
      }
      providerCallId = data.sid || null;
      callStatus = "queued";
    }

    // Log call
    await serviceClient.from("call_log").insert({
      tenant_id,
      caller_id: user.id,
      member_id: safeMemberId,
      recipient_phone: phone,
      call_type: "outbound",
      status: callStatus,
      provider: voiceProvider,
      provider_call_id: providerCallId,
      reference_type: reference_type || null,
      reference_id: reference_id || null,
      notes: notes || null,
    });

    return new Response(
      JSON.stringify({ success: true, status: callStatus, provider: voiceProvider }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("make-call error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
