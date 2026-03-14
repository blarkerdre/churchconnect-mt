import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Check admin or unit_leader role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const userRoles = (roles || []).map((r: any) => r.role);
    const canSend =
      userRoles.includes("admin") ||
      userRoles.includes("super_admin") ||
      userRoles.includes("unit_leader");

    if (!canSend) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { recipients, message, sms_type, reference_id } = body;
    // recipients: Array<{ phone: string, member_id?: string }>

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return new Response(JSON.stringify({ error: "No recipients provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
          error_message: "Invalid phone number format (must be E.164)",
        });
        continue;
      }

      try {
        const params = new URLSearchParams({
          To: phone,
          From: TWILIO_FROM,
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
            recipient_phone: phone,
            recipient_member_id: recipient.member_id || null,
            message,
            sms_type: sms_type || "bulk",
            reference_id: reference_id || null,
            status: "sent",
            message_sid: data.sid || null,
            delivery_status: "queued",
          });
        } else {
          failed++;
          logs.push({
            sender_id: userId,
            recipient_phone: phone,
            recipient_member_id: recipient.member_id || null,
            message,
            sms_type: sms_type || "bulk",
            reference_id: reference_id || null,
            status: "failed",
            error_message: data.message || JSON.stringify(data),
          });
        }
      } catch (err) {
        failed++;
        logs.push({
          sender_id: userId,
          recipient_phone: phone,
          recipient_member_id: recipient.member_id || null,
          message,
          sms_type: sms_type || "bulk",
          reference_id: reference_id || null,
          status: "failed",
          error_message: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    // Log all SMS using service role to bypass RLS
    if (logs.length > 0) {
      const serviceClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
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
