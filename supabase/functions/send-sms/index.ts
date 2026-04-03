import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

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
    const userId = user.id;

    const body = await req.json();
    const { recipients, message, sms_type, reference_id, channel, tenant_id } = body;

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service client for tenant-scoped auth checks
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

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

    // Check tenant-scoped admin or unit_leader role
    const { data: isAdmin } = await serviceClient.rpc("is_admin", { _user_id: userId, _tenant_id: tenant_id });
    const { data: isLeader } = await serviceClient.rpc("has_role", {
      _user_id: userId,
      _role: "unit_leader",
      _tenant_id: tenant_id,
    });

    if (!isAdmin && !isLeader) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const msgChannel = channel === "whatsapp" ? "whatsapp" : "sms";

    // Resolve per-tenant Twilio numbers
    let fromNumber = TWILIO_FROM;
    let tenantWhatsappFrom: string | null = null;
    {
      const { data: tenantRow } = await serviceClient
        .from("tenants")
        .select("settings")
        .eq("id", tenant_id)
        .single();
      if (tenantRow?.settings) {
        const s = tenantRow.settings as Record<string, unknown>;
        if (msgChannel === "sms" && s.twilio_sms_from) {
          const tenantFrom = s.twilio_sms_from as string;
          try { validateE164(tenantFrom, "Tenant SMS sender"); } catch { /* fall back to default */ }
          if (/^\+[1-9]\d{6,14}$/.test(tenantFrom.replace(/[\s\-\(\)\.]/g, ""))) {
            fromNumber = tenantFrom;
          }
        }
        if (s.twilio_whatsapp_from) {
          tenantWhatsappFrom = s.twilio_whatsapp_from as string;
        }
      }
    }

    if (msgChannel === "whatsapp") {
      const waFromRaw = tenantWhatsappFrom || Deno.env.get("TWILIO_WHATSAPP_FROM");
      if (!waFromRaw) throw new Error("TWILIO_WHATSAPP_FROM is not configured");
      const waFrom = waFromRaw.replace(/\s/g, "");
      fromNumber = waFrom.startsWith("whatsapp:") ? waFrom : `whatsapp:${waFrom}`;
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return new Response(JSON.stringify({ error: "No recipients provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Quota enforcement ──
    const { data: tenantLimits } = await serviceClient
      .from("tenants")
      .select("sms_limit_monthly, whatsapp_limit_monthly")
      .eq("id", tenant_id)
      .single();

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const limitField = msgChannel === "whatsapp" ? "whatsapp_limit_monthly" : "sms_limit_monthly";
    const quota = tenantLimits?.[limitField] || 0;

    let currentUsage = 0;
    if (quota > 0) {
      const { count } = await serviceClient
        .from("sms_log")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenant_id)
        .eq("channel", msgChannel)
        .eq("status", "sent")
        .gte("created_at", monthStart.toISOString());
      currentUsage = count || 0;

      const remaining = quota - currentUsage;
      if (recipients.length > remaining) {
        return new Response(
          JSON.stringify({
            error: `${msgChannel === "whatsapp" ? "WhatsApp" : "SMS"} quota exceeded. ${Math.max(remaining, 0)} messages remaining this month (limit: ${quota}).`,
            remaining: Math.max(remaining, 0),
            limit: quota,
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    for (const recipient of recipients) {
      const normalized = normalizeE164(recipient.phone?.trim() || "");
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
          error_message: "Invalid phone number format (must be E.164)",
          ...(tenant_id ? { tenant_id } : {}),
        });
        continue;
      }

      try {
        const toNumber = msgChannel === "whatsapp" ? `whatsapp:${normalized}` : normalized;

        const params = new URLSearchParams({
          To: toNumber,
          From: fromNumber,
          Body: message,
          StatusCallback: webhookUrl,
        });

        const response = await fetch(`${GATEWAY_URL}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": TWILIO_API_KEY,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params,
        });

        const data = await response.json();

        if (response.ok) {
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
        } else {
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
            error_message: data.message || JSON.stringify(data),
            ...(tenant_id ? { tenant_id } : {}),
          });
        }
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

    return new Response(
      JSON.stringify({ sent, failed, total: recipients.length }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("send-sms error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
