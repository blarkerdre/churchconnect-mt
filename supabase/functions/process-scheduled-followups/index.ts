import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

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
      return new Response(JSON.stringify({ error: fetchErr.message }), {
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
        if (msg.channel === "sms") {
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
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendSms(
  msg: any,
  supabase: any,
  supabaseUrl: string
) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY") || Deno.env.get("TWILIO_API_KEY_1");
  if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY not configured");

  const TWILIO_FROM = Deno.env.get("TWILIO_FROM_NUMBER");
  if (!TWILIO_FROM) throw new Error("TWILIO_FROM_NUMBER not configured");

  // Check tenant-specific Twilio number
  let fromNumber = TWILIO_FROM;
  if (msg.tenant_id) {
    const { data: tenantRow } = await supabase
      .from("tenants")
      .select("settings")
      .eq("id", msg.tenant_id)
      .single();
    if (tenantRow?.settings?.twilio_sms_from) {
      fromNumber = tenantRow.settings.twilio_sms_from;
    }
  }

  // Normalize phone
  let phone = (msg.recipient_phone || "").replace(/[\s\-\(\)\.]/g, "");
  if (/^0[1-9]\d{9,10}$/.test(phone)) phone = "+44" + phone.slice(1);
  if (!phone.startsWith("+")) phone = "+" + phone;

  const params = new URLSearchParams({
    To: phone,
    From: fromNumber,
    Body: msg.message,
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
  if (!response.ok) {
    throw new Error(`Twilio error: ${data.message || JSON.stringify(data)}`);
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
    message_sid: data.sid || null,
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
