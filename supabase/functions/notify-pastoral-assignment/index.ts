import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === serviceKey;

    if (!isServiceRole) {
      const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await anonClient.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const svcClient = createClient(supabaseUrl, serviceKey);
      const { data: isAdmin } = await svcClient.rpc("is_admin", { _user_id: user.id });
      const { data: isLeader } = await svcClient.rpc("has_role", { _user_id: user.id, _role: "unit_leader" });
      if (!isAdmin && !isLeader) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { assigned_to, subject, care_type, description, case_id, tenant_id, is_new_request } = await req.json();

    if (!assigned_to) {
      return new Response(JSON.stringify({ message: "No assignee" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch tenant settings for sender name
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", assigned_to)
      .single();

    let memberQuery = supabase
      .from("members")
      .select("phone, email, first_name")
      .eq("user_id", assigned_to);
    if (tenant_id) memberQuery = memberQuery.eq("tenant_id", tenant_id);
    const { data: memberRecord } = await memberQuery.maybeSingle();

    const recipientEmail = profile?.email || memberRecord?.email;
    const recipientPhone = memberRecord?.phone;
    const recipientName = profile?.full_name || memberRecord?.first_name || "Team Member";

    const actionLabel = is_new_request ? "New Pastoral Care Case Assigned" : "Pastoral Care Case Reassigned";
    const emailSubject = `${actionLabel}: ${subject}`;
    const introLine = is_new_request
      ? "A new pastoral care case has been assigned to you."
      : "A pastoral care case has been reassigned to you.";
    const bodyText = `Hi ${recipientName},\n\n${introLine}\n\nSubject: ${subject}\nType: ${care_type || "General"}\n${description ? `Details: ${description}\n` : ""}\nPlease log in to the Church Management System to view and manage this case.\n\nGod bless,\n${churchName}`;

    // Send email notification via queue
    if (recipientEmail) {
      const senderDomain = "notify.app.churchmanagementsuite.org";
      const fromAddress = `${churchShortName} <noreply@${senderDomain}>`;
      const messageId = `pastoral-assign-${crypto.randomUUID()}`;

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
          <h2 style="margin:0 0 16px;color:#1a2d4d;font-size:18px;">${escHtml(actionLabel)}</h2>
          <div style="background-color:#f0f4f8;border-radius:8px;padding:16px;margin:0 0 24px;">
            <p style="margin:0 0 8px;color:#555;font-size:14px;"><strong>Subject:</strong> ${escHtml(subject)}</p>
            <p style="margin:0 0 8px;color:#555;font-size:14px;"><strong>Type:</strong> ${escHtml(care_type || "General")}</p>
            ${description ? `<p style="margin:0;color:#555;font-size:14px;">${escHtml(description)}</p>` : ""}
          </div>
          <p style="margin:0 0 16px;color:#555;font-size:15px;">Please log in to the Church Management System to view and manage this case.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
          <p style="margin:0;color:#999;font-size:12px;text-align:center;">This is an automated notification from the Pastoral Care Unit.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      const payload = {
        to: recipientEmail,
        from: fromAddress,
        sender_domain: senderDomain,
        subject: emailSubject,
        html: htmlContent,
        text: bodyText,
        purpose: "transactional",
        label: "pastoral-assignment",
        message_id: messageId,
        idempotency_key: messageId,
        queued_at: new Date().toISOString(),
        ...(tenant_id ? { tenant_id } : {}),
      };

      const { error: enqueueError } = await supabase.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload,
      });

      if (enqueueError) {
        console.error("Failed to enqueue pastoral care email:", enqueueError);
      } else {
        await supabase.from("email_send_log").insert({
          message_id: messageId,
          template_name: "pastoral-assignment",
          recipient_email: recipientEmail,
          status: "pending",
          tenant_id,
        });
        console.log("Pastoral care assignment email enqueued for", recipientEmail);
      }
    }

    // Check if SMS notifications are enabled
    let smsSettingQuery = supabase
      .from("app_settings")
      .select("value")
      .eq("key", "sms_notifications_enabled");
    if (tenant_id) smsSettingQuery = smsSettingQuery.eq("tenant_id", tenant_id);
    const { data: smsSetting } = await smsSettingQuery.maybeSingle();
    
    const smsEnabled = smsSetting?.value === true || smsSetting === null;

    // Send SMS notification (only if enabled)
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
          const smsAction = is_new_request ? "been assigned a new" : "been reassigned a";
          const smsBody = `Hi ${recipientName}, you've ${smsAction} pastoral care case: "${subject}". Please check the Church Management System. - ${churchShortName}`;

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
              sender_id: assigned_to,
              recipient_phone: cleaned,
              message: smsBody,
              sms_type: "pastoral-assignment",
              reference_id: case_id,
              status: response.ok ? "sent" : "failed",
              message_sid: data.sid || null,
              error_message: response.ok ? null : (data.message || JSON.stringify(data)),
              delivery_status: response.ok ? "queued" : null,
              tenant_id,
            });

            if (response.ok) {
              console.log("Pastoral care assignment SMS sent to", cleaned);
            } else {
              console.error("SMS send failed:", data);
            }
          } catch (err) {
            console.error("SMS error:", err);
          }
        }
      }
    } else if (recipientPhone && !smsEnabled) {
      console.log("SMS notifications disabled — skipping SMS for pastoral care assignment");
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("notify-pastoral-assignment error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
