import { createClient } from "npm:@supabase/supabase-js@2";
import { assertSmsQuota, QuotaExceededError } from "../_shared/sms-quota.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TWILIO_GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const AT_SMS_URL = "https://api.africastalking.com/version1/messaging";
const TERMII_SMS_URL = "https://api.ng.termii.com/api/sms/send";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch due scheduled messages
    const { data: messages, error: fetchErr } = await supabase
      .from("followup_scheduled_messages")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString())
      .limit(50);

    if (fetchErr) {
      console.error("Failed to fetch scheduled messages:", fetchErr);
      return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    let failed = 0;

    for (const msg of messages) {
      try {
        // Resolve church name for placeholder replacement
        let churchName = "our church";
        if (msg.tenant_id) {
          const { data: tenantData } = await supabase
            .from("tenants").select("name").eq("id", msg.tenant_id).single();
          if (tenantData?.name) churchName = tenantData.name;
        }
        // Replace placeholders
        msg.message = (msg.message || "")
          .replace(/\{name\}/gi, msg.recipient_name || "there")
          .replace(/\{church\}/gi, churchName);
        if (msg.subject) {
          msg.subject = msg.subject
            .replace(/\{name\}/gi, msg.recipient_name || "there")
            .replace(/\{church\}/gi, churchName);
        }

        if (msg.channel === "sms") {
          await assertSmsQuota(supabase, msg.tenant_id, "sms", 1);
          await sendSms(msg, supabase, supabaseUrl);
        } else if (msg.channel === "email") {
          await sendEmail(msg, supabase, supabaseUrl);
        }

        await supabase
          .from("followup_scheduled_messages")
          .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", msg.id);
        sent++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`Failed to send message ${msg.id}:`, errorMsg);

        await supabase
          .from("followup_scheduled_messages")
          .update({ status: "failed", error_message: errorMsg, updated_at: new Date().toISOString() })
          .eq("id", msg.id);
        failed++;
      }
    }

    console.log(`Processed ${messages.length} scheduled followup messages: ${sent} sent, ${failed} failed`);

    return new Response(
      JSON.stringify({ processed: messages.length, sent, failed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("process-scheduled-followups error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendSms(
  msg: any,
  supabase: any,
  supabaseUrl: string
) {
  // Get tenant settings for provider
  let smsProvider = "twilio";
  let tenantSettings: Record<string, unknown> = {};
  if (msg.tenant_id) {
    const { data: tenantRow } = await supabase
      .from("tenants")
      .select("settings")
      .eq("id", msg.tenant_id)
      .single();
    if (tenantRow?.settings) {
      tenantSettings = tenantRow.settings as Record<string, unknown>;
      smsProvider = (tenantSettings.sms_provider as string) || "twilio";
    }
  }

  // Normalize phone
  let phone = (msg.recipient_phone || "").replace(/[\s\-\(\)\.]/g, "");
  if (/^0[1-9]\d{9,10}$/.test(phone)) phone = "+44" + phone.slice(1);
  if (!phone.startsWith("+")) phone = "+" + phone;
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
    throw new Error(`Invalid or missing phone number: "${msg.recipient_phone}"`);
  }

  let messageSid: string | null = null;

  if (smsProvider === "custom") {
    // Custom provider
    const { data: customConfigRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("tenant_id", msg.tenant_id)
      .eq("key", "custom_sms_provider_config")
      .maybeSingle();
    const customConfig = customConfigRow?.value as Record<string, string> | null;
    if (!customConfig?.endpoint) throw new Error("Custom SMS provider not configured");

    let bodyStr = (customConfig.body_template || "")
      .replace(/\{\{to\}\}/g, phone)
      .replace(/\{\{message\}\}/g, msg.message)
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
      throw new Error(`Custom provider error (${response.status}): ${JSON.stringify(data)}`);
    }
    messageSid = data.id || data.message_id || data.sid || null;

  } else if (smsProvider === "africastalking") {
    const { data: credData } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("tenant_id", msg.tenant_id)
      .in("key", ["africastalking_api_key", "africastalking_username", "africastalking_sender_id"]);
    const creds: Record<string, string> = {};
    (credData || []).forEach((r: any) => { creds[r.key] = r.value || ""; });

    if (!creds.africastalking_api_key || !creds.africastalking_username) {
      throw new Error("Africa's Talking credentials not configured");
    }

    const params = new URLSearchParams({
      username: creds.africastalking_username,
      to: phone,
      message: msg.message,
      ...(creds.africastalking_sender_id ? { from: creds.africastalking_sender_id } : {}),
    });

    const response = await fetch(AT_SMS_URL, {
      method: "POST",
      headers: {
        apiKey: creds.africastalking_api_key,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(`Africa's Talking error: ${JSON.stringify(data)}`);
    const recipient = data.SMSMessageData?.Recipients?.[0];
    if (recipient?.status !== "Success") {
      throw new Error(`Africa's Talking: ${recipient?.status || JSON.stringify(data)}`);
    }
    messageSid = recipient.messageId || null;

  } else if (smsProvider === "termii") {
    const { data: credData } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("tenant_id", msg.tenant_id)
      .in("key", ["termii_api_key", "termii_sender_id"]);
    const creds: Record<string, string> = {};
    (credData || []).forEach((r: any) => { creds[r.key] = r.value || ""; });

    if (!creds.termii_api_key) throw new Error("Termii API key not configured");

    const response = await fetch(TERMII_SMS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: creds.termii_api_key,
        to: phone.replace("+", ""),
        from: creds.termii_sender_id || "N-Alert",
        sms: msg.message,
        type: "plain",
        channel: "generic",
      }),
    });
    const data = await response.json();
    if (!response.ok || data.code !== "ok") {
      throw new Error(`Termii error: ${data.message || JSON.stringify(data)}`);
    }
    messageSid = data.message_id || null;

  } else {
    // Twilio (default)
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY") || Deno.env.get("TWILIO_API_KEY_1");
    if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY not configured");

    const TWILIO_FROM = Deno.env.get("TWILIO_FROM_NUMBER");
    if (!TWILIO_FROM) throw new Error("TWILIO_FROM_NUMBER not configured");

    let fromNumber = TWILIO_FROM;
    if (tenantSettings.twilio_sms_from) {
      fromNumber = tenantSettings.twilio_sms_from as string;
    }

    const webhookUrl = `${supabaseUrl}/functions/v1/twilio-webhook`;
    const params = new URLSearchParams({
      To: phone,
      From: fromNumber,
      Body: msg.message,
      StatusCallback: webhookUrl,
    });

    const response = await fetch(`${TWILIO_GATEWAY_URL}/Messages.json`, {
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
      throw new Error(`Twilio error: ${data.message || JSON.stringify(data)}`);
    }
    messageSid = data.sid || null;
  }

  // Log to sms_log
  await supabase.from("sms_log").insert({
    sender_id: msg.created_by,
    recipient_phone: phone,
    recipient_member_id: msg.member_id,
    message: msg.message,
    sms_type: "followup",
    reference_id: msg.followup_id,
    status: "sent",
    channel: "sms",
    message_sid: messageSid,
    delivery_status: "queued",
    ...(msg.tenant_id ? { tenant_id: msg.tenant_id } : {}),
  });
}

async function sendEmail(
  msg: any,
  supabase: any,
  supabaseUrl: string
) {
    // Resolve church name from tenant
  let churchName = "ChurchConnect";
  if (msg.tenant_id) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", msg.tenant_id)
      .single();
    if (tenant?.name) churchName = tenant.name;
  }

  // Replace placeholders in message
  let finalMessage = msg.message;
  finalMessage = finalMessage.replace(/\{name\}/gi, msg.recipient_name || "there");
  finalMessage = finalMessage.replace(/\{church\}/gi, churchName);

  // Resolve followup type
  let followupType = "";
  if (msg.followup_id) {
    const { data: followup } = await supabase
      .from("followups")
      .select("followup_type")
      .eq("id", msg.followup_id)
      .single();
    if (followup?.followup_type) followupType = followup.followup_type;
  }

  // Call send-transactional-email
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const response = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      template_name: "followup-reminder",
      recipient_email: msg.recipient_email,
      tenant_id: msg.tenant_id,
      templateData: {
        recipientName: msg.recipient_name || "",
        churchName,
        message: msg.message,
        followupType,
      },
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(`Email send failed: ${errData.error || response.statusText}`);
  }
}
