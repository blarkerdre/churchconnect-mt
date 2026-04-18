import { createClient } from "npm:@supabase/supabase-js@2";

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

    // Verify tenant membership
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
        .select("value")
        .eq("tenant_id", tenant_id)
        .eq("key", "custom_voice_provider_config")
        .maybeSingle();
      const customConfig = customConfigRow?.value as Record<string, string> | null;
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

      const response = await fetch(customConfig.endpoint, {
        method: customConfig.method || "POST",
        headers,
        body: bodyStr,
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
      member_id: member_id || null,
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
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
