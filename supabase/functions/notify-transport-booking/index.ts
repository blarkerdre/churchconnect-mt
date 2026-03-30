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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    if (token !== serviceKey) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const { notification_type, booking_id, member_name, pickup, destination, request_date, pickup_time, tenant_id } = body;

    // Fetch tenant branding
    let churchName = "Church";
    let churchShortName = "Church";
    if (tenant_id) {
      const { data: tenantRow } = await supabase
        .from("tenants").select("name, settings").eq("id", tenant_id).single();
      if (tenantRow) {
        const s = tenantRow.settings as Record<string, unknown> | null;
        churchName = (s?.email_sender_name as string) || tenantRow.name || churchName;
        churchShortName = churchName;
      }
    }

    // Determine recipients
    const userIds: string[] = [];
    if (notification_type === "new_booking" && Array.isArray(body.leader_user_ids)) {
      userIds.push(...body.leader_user_ids);
    } else if (notification_type === "assignment" && body.assigned_user_id) {
      userIds.push(body.assigned_user_id);
    }

    if (userIds.length === 0) {
      return new Response(JSON.stringify({ message: "No recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check SMS enabled
    const { data: smsSetting } = await supabase
      .from("app_settings").select("value")
      .eq("key", "sms_notifications_enabled").eq("tenant_id", tenant_id).maybeSingle();
    const smsEnabled = smsSetting?.value === true || smsSetting === null;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    const TWILIO_FROM = Deno.env.get("TWILIO_FROM_NUMBER");

    const senderDomain = "notify.app.churchmanagementsuite.org";
    const fromAddress = `${churchShortName} <noreply@${senderDomain}>`;

    const isNewBooking = notification_type === "new_booking";
    const emailSubject = isNewBooking
      ? `New Transport Booking: ${member_name}`
      : `Transport Booking Assigned to You`;

    for (const userId of userIds) {
      // Get contact info
      const { data: memberRow } = await supabase
        .from("members").select("phone, email, first_name")
        .eq("user_id", userId).eq("tenant_id", tenant_id).maybeSingle();
      const { data: profile } = await supabase
        .from("profiles").select("full_name, email")
        .eq("user_id", userId).single();

      const recipientEmail = profile?.email || memberRow?.email;
      const recipientPhone = memberRow?.phone;
      const recipientName = profile?.full_name || memberRow?.first_name || "Team Member";

      // Send email
      if (recipientEmail) {
        const messageId = `transport-${crypto.randomUUID()}`;
        const detailBlock = `
          <p style="margin:0 0 8px;color:#555;font-size:14px;"><strong>Passenger:</strong> ${escHtml(member_name || "Unknown")}</p>
          <p style="margin:0 0 8px;color:#555;font-size:14px;"><strong>Pickup:</strong> ${escHtml(pickup || "TBC")}</p>
          <p style="margin:0 0 8px;color:#555;font-size:14px;"><strong>Destination:</strong> ${escHtml(destination || "Church")}</p>
          <p style="margin:0 0 8px;color:#555;font-size:14px;"><strong>Date:</strong> ${escHtml(request_date || "TBC")}${pickup_time ? ` at ${escHtml(pickup_time)}` : ""}</p>`;

        const heading = isNewBooking
          ? "New Transport Booking Request"
          : "Transport Booking Assigned to You";

        const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background-color:#1a2d4d;padding:24px 32px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${escHtml(churchName)}</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;color:#333;font-size:16px;">Dear ${escHtml(recipientName)},</p>
          <h2 style="margin:0 0 16px;color:#1a2d4d;font-size:18px;">${heading}</h2>
          <div style="background-color:#f0f4f8;border-radius:8px;padding:16px;margin:0 0 24px;">${detailBlock}</div>
          <p style="margin:0 0 16px;color:#555;font-size:15px;">Please log in to manage this booking.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
          <p style="margin:0;color:#999;font-size:12px;text-align:center;">Automated notification from Transportation.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

        const textContent = `Hi ${recipientName},\n\n${heading}\n\nPassenger: ${member_name}\nPickup: ${pickup}\nDestination: ${destination}\nDate: ${request_date}${pickup_time ? ` at ${pickup_time}` : ""}\n\nPlease log in to manage this booking.\n\n${churchName}`;

        const payload = {
          to: recipientEmail,
          from: fromAddress,
          sender_domain: senderDomain,
          subject: emailSubject,
          html: htmlContent,
          text: textContent,
          purpose: "transactional",
          label: "transport-booking-notification",
          message_id: messageId,
          idempotency_key: messageId,
          queued_at: new Date().toISOString(),
        };

        const { error: enqueueError } = await supabase.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload,
        });

        if (enqueueError) {
          console.error("Failed to enqueue transport email:", enqueueError);
        } else {
          await supabase.from("email_send_log").insert({
            message_id: messageId,
            template_name: "transport-booking-notification",
            recipient_email: recipientEmail,
            status: "pending",
            tenant_id,
          });
          console.log("Transport email enqueued for", recipientEmail);
        }
      }

      // Send SMS
      if (recipientPhone && smsEnabled && LOVABLE_API_KEY && TWILIO_API_KEY && TWILIO_FROM) {
        let cleaned = recipientPhone.replace(/[\s\-\(\)\.]/g, "");
        if (/^0[1-9]\d{9,10}$/.test(cleaned)) cleaned = "+44" + cleaned.slice(1);
        if (!cleaned.startsWith("+")) cleaned = "+" + cleaned;

        if (/^\+[1-9]\d{6,14}$/.test(cleaned)) {
          const smsBody = isNewBooking
            ? `Hi ${recipientName}, new transport booking from ${member_name}: ${pickup} → ${destination} on ${request_date}. Please check the system. - ${churchShortName}`
            : `Hi ${recipientName}, you've been assigned a transport booking for ${member_name}: ${pickup} → ${destination} on ${request_date}. - ${churchShortName}`;

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
                To: cleaned, From: TWILIO_FROM, Body: smsBody, StatusCallback: webhookUrl,
              }),
            });
            const data = await response.json();
            await supabase.from("sms_log").insert({
              sender_id: userId,
              recipient_phone: cleaned,
              message: smsBody,
              sms_type: "transport-booking-notification",
              reference_id: booking_id,
              status: response.ok ? "sent" : "failed",
              message_sid: data.sid || null,
              error_message: response.ok ? null : (data.message || JSON.stringify(data)),
              delivery_status: response.ok ? "queued" : null,
              tenant_id,
            });
          } catch (err) {
            console.error("Transport SMS error:", err);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("notify-transport-booking error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
