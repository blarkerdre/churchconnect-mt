import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify service role auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    if (token !== serviceKey) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { leader_user_id, member_name, centre_name, centre_id, tenant_id } = await req.json();

    if (!leader_user_id) {
      return new Response(JSON.stringify({ message: "No leader" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch tenant settings for branding
    let churchName = "Winners Chapel International Cardiff";
    let churchShortName = "Winners Chapel Cardiff";
    if (tenant_id) {
      const { data: tenantRow } = await supabase
        .from("tenants")
        .select("name, settings")
        .eq("id", tenant_id)
        .single();
      if (tenantRow) {
        const s = tenantRow.settings as Record<string, unknown> | null;
        churchName = (s?.email_sender_name as string) || tenantRow.name || churchName;
        churchShortName = churchName;
      }
    }

    // Get leader contact info
    let leaderQuery = supabase
      .from("members")
      .select("phone, email, first_name")
      .eq("user_id", leader_user_id);
    if (tenant_id) leaderQuery = leaderQuery.eq("tenant_id", tenant_id);
    const { data: leaderMember } = await leaderQuery.maybeSingle();

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", leader_user_id)
      .single();

    const recipientEmail = profile?.email || leaderMember?.email;
    const recipientPhone = leaderMember?.phone;
    const recipientName = profile?.full_name || leaderMember?.first_name || "Leader";

    // Send email
    if (recipientEmail) {
      const senderDomain = "notify.app.churchmanagementsuite.org";
      const fromAddress = `${churchShortName} <noreply@${senderDomain}>`;
      const messageId = `wsf-leader-${crypto.randomUUID()}`;
      const emailSubject = `New Member Joined Your WSF Centre: ${centre_name}`;

      const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background-color:#1a2d4d;padding:24px 32px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${escHtml(churchName)}</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;color:#333333;font-size:16px;">Dear ${escHtml(recipientName)},</p>
          <h2 style="margin:0 0 16px;color:#1a2d4d;font-size:18px;">New Member Joined Your WSF Centre</h2>
          <div style="background-color:#f0f4f8;border-radius:8px;padding:16px;margin:0 0 24px;">
            <p style="margin:0 0 8px;color:#555;font-size:14px;"><strong>Member:</strong> ${escHtml(member_name || "Unknown")}</p>
            <p style="margin:0;color:#555;font-size:14px;"><strong>Centre:</strong> ${escHtml(centre_name || "Unknown")}</p>
          </div>
          <p style="margin:0 0 16px;color:#555;font-size:15px;">Please log in to the Church Management System to view and welcome this new member.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
          <p style="margin:0;color:#999;font-size:12px;text-align:center;">This is an automated notification from the WSF Management Unit.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      const textContent = `Hi ${recipientName},\n\n${member_name} has joined your WSF centre: ${centre_name}.\n\nPlease log in to the Church Management System to welcome them.\n\nGod bless,\n${churchName}`;

      const payload = {
        to: recipientEmail,
        from: fromAddress,
        sender_domain: senderDomain,
        subject: emailSubject,
        html: htmlContent,
        text: textContent,
        purpose: "transactional",
        label: "wsf-leader-notification",
        message_id: messageId,
        idempotency_key: messageId,
        queued_at: new Date().toISOString(),
      };

      const { error: enqueueError } = await supabase.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload,
      });

      if (enqueueError) {
        console.error("Failed to enqueue WSF leader email:", enqueueError);
      } else {
        await supabase.from("email_send_log").insert({
          message_id: messageId,
          template_name: "wsf-leader-notification",
          recipient_email: recipientEmail,
          status: "pending",
          ...(tenant_id ? { tenant_id } : {}),
        });
        console.log("WSF leader email enqueued for", recipientEmail);
      }
    }

    // Check SMS enabled
    let smsQuery = supabase
      .from("app_settings")
      .select("value")
      .eq("key", "sms_notifications_enabled");
    if (tenant_id) smsQuery = smsQuery.eq("tenant_id", tenant_id);
    const { data: smsSetting } = await smsQuery.maybeSingle();
    const smsEnabled = smsSetting?.value === true || smsSetting === null;

    // Send SMS
    if (recipientPhone && smsEnabled) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
      const TWILIO_FROM = Deno.env.get("TWILIO_FROM_NUMBER");

      if (LOVABLE_API_KEY && TWILIO_API_KEY && TWILIO_FROM) {
        let cleaned = recipientPhone.replace(/[\s\-\(\)\.]/g, "");
        if (/^0[1-9]\d{9,10}$/.test(cleaned)) {
          cleaned = "+44" + cleaned.slice(1);
        }
        if (!cleaned.startsWith("+")) cleaned = "+" + cleaned;

        if (/^\+[1-9]\d{6,14}$/.test(cleaned)) {
          const smsBody = `Hi ${recipientName}, ${member_name} has joined your WSF centre: ${centre_name}. Please check the Church Management System. - ${churchShortName}`;

          try {
            const webhookUrl = `${supabaseUrl}/functions/v1/twilio-webhook`;
            const response = await fetch(`${GATEWAY_URL}/Messages.json`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "X-Connection-Api-Key": TWILIO_API_KEY,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                To: cleaned,
                From: TWILIO_FROM,
                Body: smsBody,
                StatusCallback: webhookUrl,
              }),
            });

            const data = await response.json();
            await supabase.from("sms_log").insert({
              sender_id: leader_user_id,
              recipient_phone: cleaned,
              message: smsBody,
              sms_type: "wsf-leader-notification",
              reference_id: centre_id,
              status: response.ok ? "sent" : "failed",
              message_sid: data.sid || null,
              error_message: response.ok ? null : (data.message || JSON.stringify(data)),
              delivery_status: response.ok ? "queued" : null,
              ...(tenant_id ? { tenant_id } : {}),
            });

            if (response.ok) {
              console.log("WSF leader SMS sent to", cleaned);
            } else {
              console.error("WSF leader SMS failed:", data);
            }
          } catch (err) {
            console.error("WSF leader SMS error:", err);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("notify-wsf-leader error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
