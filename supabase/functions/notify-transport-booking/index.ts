import { createClient } from "npm:@supabase/supabase-js@2";
import { checkSmsQuota } from "../_shared/sms-quota.ts";

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

    const supabase = createClient(supabaseUrl, serviceKey);

    // Allow either service-role (internal callers) or a valid user JWT (browser)
    if (token !== serviceKey) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
      if (claimsErr || !claims?.claims?.sub) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    const body = await req.json();

    // Short-circuit: driver_route notification (in-app only)
    if (body.notification_type === "driver_route") {
      const driverUserId: string | undefined = body.driver_user_id;
      const stops: Array<Record<string, unknown>> = Array.isArray(body.stops) ? body.stops : [];
      const tenantIdIn: string = body.tenant_id;
      const dateFrom: string = body.date_from || "";
      const dateTo: string = body.date_to || dateFrom;
      if (!driverUserId || !tenantIdIn || stops.length === 0) {
        return new Response(JSON.stringify({ error: "Missing driver_user_id, tenant_id, or stops" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const dateLabel = dateFrom && dateTo && dateFrom !== dateTo ? `${dateFrom} → ${dateTo}` : (dateFrom || "");
      const lines = stops.map((s, i) => {
        const name = (s.passenger_name as string) || "Passenger";
        const time = (s.pickup_time as string) || "TBC";
        const addr = (s.pickup_address as string) || "";
        const pc = (s.pickup_postcode as string) || "";
        const phone = (s.phone as string) || "";
        const pax = (s.passengers as number) || 1;
        return `${i + 1}. ${time} — ${name}${pax > 1 ? ` (${pax} pax)` : ""} @ ${addr}${pc ? ` [${pc}]` : ""}${phone ? ` • ${phone}` : ""}`;
      });
      const title = `Your pickup route${dateLabel ? ` (${dateLabel})` : ""}`;
      const message = `You have ${stops.length} pickup${stops.length === 1 ? "" : "s"} scheduled:\n${lines.join("\n")}`;
      const { error: nErr } = await supabase.from("notifications").insert({
        user_id: driverUserId,
        tenant_id: tenantIdIn,
        title,
        message,
        type: "transport",
        reference_type: "transport",
        reference_id: null,
      });
      if (nErr) {
        return new Response(JSON.stringify({ error: nErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true, stops: stops.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Short-circuit: driver_availability notification (in-app + email; no SMS)
    if (body.notification_type === "driver_availability") {
      const tenantIdIn: string = body.tenant_id;
      const leaderIds: string[] = Array.isArray(body.leader_user_ids) ? body.leader_user_ids : [];
      if (!tenantIdIn || leaderIds.length === 0) {
        return new Response(JSON.stringify({ error: "Missing tenant_id or leader_user_ids" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const driverName = (body.driver_name || "A driver").toString();
      const driverUnit = (body.driver_unit || "Transportation").toString();
      const dateStr = (body.available_date || "").toString();
      const service = (body.service_type || "").toString();
      const area = (body.pickup_area || "").toString();
      const seats = Number(body.seats || 1);
      const notes = (body.notes || "").toString();

      const title = `Driver availability: ${driverName}`;
      const message = `${driverName} (${driverUnit}) is available on ${dateStr}${service ? ` for ${service}` : ""}. Pickup area: ${area}. Seats: ${seats}.${notes ? ` Notes: ${notes}` : ""}`;

      // Fetch tenant branding for email
      let churchName = "Church";
      {
        const { data: tenantRow } = await supabase
          .from("tenants").select("name, settings").eq("id", tenantIdIn).single();
        if (tenantRow) {
          const s = tenantRow.settings as Record<string, unknown> | null;
          churchName = (s?.email_sender_name as string) || tenantRow.name || churchName;
        }
      }

      const senderDomain = "notify.app.churchmanagementsuite.org";
      const cleanedFromName = String(churchName || "").replace(/[\x00-\x1F\x7F]/g, "").replace(/\s+/g, " ").trim() || "Church";
      const safeFromName = `"${cleanedFromName.replace(/[\\"]/g, "\\$&")}"`;
      const fromAddress = `${safeFromName} <noreply@${senderDomain}>`;

      for (const leaderId of leaderIds) {
        // In-app notification
        await supabase.from("notifications").insert({
          user_id: leaderId,
          tenant_id: tenantIdIn,
          title,
          message,
          type: "transport",
          reference_type: "transport",
          reference_id: body.availability_id || null,
        });

        // Email
        const { data: profile } = await supabase
          .from("profiles").select("full_name, email")
          .eq("user_id", leaderId).eq("tenant_id", tenantIdIn).maybeSingle();
        const recipientEmail = profile?.email;
        const recipientName = profile?.full_name || "Leader";
        if (!recipientEmail) continue;
        const normalizedEmail = recipientEmail.trim().toLowerCase();
        let unsubscribeToken: string | null = null;
        const { data: existingToken } = await supabase
          .from("email_unsubscribe_tokens")
          .select("token").eq("email", normalizedEmail).is("used_at", null)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (existingToken?.token) {
          unsubscribeToken = existingToken.token;
        } else {
          const newToken = crypto.randomUUID();
          const { error: tErr } = await supabase
            .from("email_unsubscribe_tokens")
            .insert({ email: normalizedEmail, token: newToken });
          if (!tErr) unsubscribeToken = newToken;
        }
        if (!unsubscribeToken) continue;

        const messageId = `driver-avail-${crypto.randomUUID()}`;
        const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f5f7;padding:24px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
  <div style="background:#1a2d4d;padding:20px;text-align:center;color:#fff;"><h1 style="margin:0;font-size:18px;">${escHtml(churchName)}</h1></div>
  <div style="padding:24px;color:#333;">
    <p>Dear ${escHtml(recipientName)},</p>
    <h2 style="color:#1a2d4d;font-size:16px;margin:12px 0;">Driver availability submitted</h2>
    <p><strong>${escHtml(driverName)}</strong> (${escHtml(driverUnit)}) has marked themselves available to pick passengers.</p>
    <div style="background:#f0f4f8;border-radius:6px;padding:12px;margin:12px 0;font-size:14px;">
      <p style="margin:4px 0;"><strong>Date:</strong> ${escHtml(dateStr)}</p>
      ${service ? `<p style="margin:4px 0;"><strong>Service:</strong> ${escHtml(service)}</p>` : ""}
      <p style="margin:4px 0;"><strong>Pickup area:</strong> ${escHtml(area)}</p>
      <p style="margin:4px 0;"><strong>Seats available:</strong> ${seats}</p>
      ${notes ? `<p style="margin:4px 0;"><strong>Notes:</strong> ${escHtml(notes)}</p>` : ""}
    </div>
    <p style="color:#555;font-size:13px;">Log in to the Transportation page to match this driver to a pending booking.</p>
  </div>
</div></body></html>`;
        const text = `${driverName} (${driverUnit}) is available on ${dateStr}${service ? ` for ${service}` : ""}.\nPickup area: ${area}\nSeats: ${seats}${notes ? `\nNotes: ${notes}` : ""}`;
        await supabase.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            to: recipientEmail,
            from: fromAddress,
            sender_domain: senderDomain,
            subject: `Driver availability: ${driverName}`,
            html, text,
            purpose: "transactional",
            label: "driver-availability-notification",
            message_id: messageId,
            idempotency_key: messageId,
            unsubscribe_token: unsubscribeToken,
            queued_at: new Date().toISOString(),
            tenant_id: tenantIdIn,
          },
        });
      }
      return new Response(JSON.stringify({ ok: true, notified: leaderIds.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { notification_type, booking_id, member_name, pickup, destination, request_date, pickup_time, tenant_id } = body;

    const pickupLocationDescription: string = (body.pickup_location_description || "").toString().trim();
    const journeyType: string = body.journey_type || "Single";
    const returnDate: string | null = body.return_date || null;
    const returnTime: string | null = body.return_time || null;
    const isRoundTrip = journeyType === "Round Trip";
    const journeyLabel = isRoundTrip ? "Round Trip" : "Single Trip";
    const returnLine = isRoundTrip && (returnDate || returnTime)
      ? `Return: ${returnDate || "TBC"}${returnTime ? ` at ${returnTime}` : ""}`
      : "";

    // Fetch tenant branding
    let churchName = "Church";
    let churchShortName = "Church";
    {
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
    let passengerMode = false;
    if (notification_type === "new_booking" && Array.isArray(body.leader_user_ids)) {
      userIds.push(...body.leader_user_ids);
    } else if (notification_type === "assignment" && body.assigned_user_id) {
      userIds.push(body.assigned_user_id);
    } else if (notification_type === "passenger_status") {
      passengerMode = true;
      // Look up the passenger's user_id from the member record
      if (body.member_id) {
        const { data: m } = await supabase
          .from("members").select("user_id").eq("id", body.member_id).eq("tenant_id", tenant_id).maybeSingle();
        if (m?.user_id) userIds.push(m.user_id);
      }
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
    const safeFromName = `"${String(churchShortName).replace(/[\\"]/g, "\\$&")}"`;
    const fromAddress = `${safeFromName} <noreply@${senderDomain}>`;

    const isNewBooking = notification_type === "new_booking";
    const passengerStatus: string | undefined = body.status;
    const stopNumber: number | undefined = typeof body.stop_number === "number" ? body.stop_number : undefined;
    const driverName: string = (body.driver_name || "").toString().trim();
    const driverPhone: string = (body.driver_phone || "").toString().trim();
    const driverSuffix = driverName
      ? ` Driver: ${driverName}${driverPhone ? ` (${driverPhone})` : ""}.`
      : "";
    const pickupAtPhrase = pickup ? ` from ${pickup}` : "";
    const pickupDescPhrase = pickupLocationDescription ? ` — ${pickupLocationDescription}` : "";
    const passengerHeadings: Record<string, { subject: string; heading: string; bodyLine: string }> = {
      "Pickup Scheduled": {
        subject: `Your pickup time is scheduled`,
        heading: "Your Pickup Time",
        bodyLine: `Your driver will pick you up at ${pickup_time || "the scheduled time"}${pickupAtPhrase}${pickupDescPhrase}${stopNumber ? ` (Stop #${stopNumber} on the route)` : ""}.${driverSuffix} Please be ready a few minutes early.`,
      },
      "Confirmed": {
        subject: `Your transport is confirmed`,
        heading: "Your Transport Booking is Confirmed",
        bodyLine: "We've confirmed your transport booking. We'll be in touch closer to the time.",
      },
      "Notified": {
        subject: `Your ride is on the way`,
        heading: "Your Ride is on the Way",
        bodyLine: "Your driver is on the way. Please be ready at your pickup point.",
      },
      "Checked In": {
        subject: `Pickup confirmed`,
        heading: "Pickup Confirmed",
        bodyLine: "Thanks for confirming. Your driver will be with you shortly.",
      },
      "Picked Up": {
        subject: `You're on your way`,
        heading: "You're On Your Way",
        bodyLine: "You've been picked up — see you soon at the destination.",
      },
      "Completed": {
        subject: `Trip completed`,
        heading: "Trip Completed",
        bodyLine: "Thanks for travelling with us. God bless.",
      },
      "No-Show": {
        subject: `Transport booking marked as no-show`,
        heading: "Marked as No-Show",
        bodyLine: "Your transport booking was marked as a no-show. Please contact us if this is incorrect.",
      },
      "Cancelled": {
        subject: `Transport booking cancelled`,
        heading: "Booking Cancelled",
        bodyLine: "Your transport booking has been cancelled. Please get in touch if you still need a ride.",
      },
    };
    const psPreset = passengerMode && passengerStatus ? passengerHeadings[passengerStatus] : null;

    const emailSubject = passengerMode
      ? (psPreset?.subject || `Transport booking update`)
      : isNewBooking
        ? `New Transport Booking: ${member_name}`
        : `Transport Booking Assigned to You`;

    for (const userId of userIds) {
      // Get contact info
      const { data: memberRow } = await supabase
        .from("members").select("phone, email, first_name")
        .eq("user_id", userId).eq("tenant_id", tenant_id).maybeSingle();
      const { data: profile } = await supabase
        .from("profiles").select("full_name, email")
        .eq("user_id", userId).eq("tenant_id", tenant_id).maybeSingle();

      const recipientEmail = profile?.email || memberRow?.email;
      const recipientPhone = memberRow?.phone;
      const recipientName = profile?.full_name || memberRow?.first_name || (passengerMode ? "there" : "Team Member");

      // In-app notification (bell + push via trigger)
      try {
        const notifTitle = passengerMode
          ? (psPreset?.heading || "Transport Booking Update")
          : isNewBooking
            ? "New Transport Booking"
            : "Transport Booking Assigned";
        const notifMessage = passengerMode
          ? (psPreset?.bodyLine || "There is an update on your transport booking.")
          : isNewBooking
            ? `${member_name || "A passenger"} requested transport: ${pickup || "TBC"} → ${destination || "Church"} on ${request_date || "TBC"}${pickup_time ? ` at ${pickup_time}` : ""}.`
            : `You've been assigned a transport booking for ${member_name || "a passenger"}: ${pickup || "TBC"} → ${destination || "Church"} on ${request_date || "TBC"}${pickup_time ? ` at ${pickup_time}` : ""}.`;
        const { error: notifErr } = await supabase.from("notifications").insert({
          user_id: userId,
          tenant_id,
          title: notifTitle,
          message: notifMessage,
          type: "transport",
          reference_type: "transport",
          reference_id: booking_id,
        });
        if (notifErr) console.error("Failed to insert transport notification:", notifErr);
      } catch (e) {
        console.error("Transport notification insert error:", e);
      }


      // Send email
      if (recipientEmail) {
        const normalizedEmail = recipientEmail.trim().toLowerCase();
        let unsubscribeToken: string | null = null;
        const { data: existingToken } = await supabase
          .from("email_unsubscribe_tokens")
          .select("token")
          .eq("email", normalizedEmail)
          .is("used_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingToken?.token) {
          unsubscribeToken = existingToken.token;
        } else {
          const newToken = crypto.randomUUID();
          const { error: tokenErr } = await supabase
            .from("email_unsubscribe_tokens")
            .insert({ email: normalizedEmail, token: newToken });

          if (tokenErr) {
            const { data: retryToken } = await supabase
              .from("email_unsubscribe_tokens")
              .select("token")
              .eq("email", normalizedEmail)
              .is("used_at", null)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            unsubscribeToken = retryToken?.token || null;
          } else {
            unsubscribeToken = newToken;
          }
        }

        if (!unsubscribeToken) {
          console.error("Skipping transport email: missing unsubscribe token", { recipientEmail });
          continue;
        }

        const messageId = `transport-${crypto.randomUUID()}`;
        const detailBlock = `
          <p style="margin:0 0 8px;color:#555;font-size:14px;"><strong>Journey:</strong> ${escHtml(journeyLabel)}</p>
          <p style="margin:0 0 8px;color:#555;font-size:14px;"><strong>Pickup:</strong> ${escHtml(pickup || "TBC")}</p>
          ${pickupLocationDescription ? `<p style="margin:0 0 8px;color:#1a2d4d;font-size:14px;background:#eef3fb;border-left:3px solid #1a2d4d;padding:8px 10px;border-radius:4px;"><strong>Pickup location description:</strong><br/>${escHtml(pickupLocationDescription)}</p>` : ""}
          <p style="margin:0 0 8px;color:#555;font-size:14px;"><strong>Destination:</strong> ${escHtml(destination || "Church")}</p>
          <p style="margin:0 0 8px;color:#555;font-size:14px;"><strong>Date:</strong> ${escHtml(request_date || "TBC")}${pickup_time ? ` at ${escHtml(pickup_time)}` : ""}</p>
          ${isRoundTrip ? `<p style="margin:0 0 8px;color:#555;font-size:14px;"><strong>Return:</strong> ${escHtml(returnDate || "TBC")}${returnTime ? ` at ${escHtml(returnTime)}` : ""}</p>` : ""}
          ${body.driver_name ? `<p style="margin:0 0 8px;color:#555;font-size:14px;"><strong>Driver:</strong> ${escHtml(body.driver_name)}${body.driver_phone ? ` (${escHtml(body.driver_phone)})` : ""}</p>` : ""}
          ${!passengerMode ? `<p style="margin:0 0 8px;color:#555;font-size:14px;"><strong>Passenger:</strong> ${escHtml(member_name || "Unknown")}</p>` : ""}
          ${stopNumber ? `<p style="margin:0 0 8px;color:#555;font-size:14px;"><strong>Stop #:</strong> ${stopNumber}</p>` : ""}`;

        const heading = passengerMode
          ? (psPreset?.heading || "Transport Booking Update")
          : isNewBooking
            ? "New Transport Booking Request"
            : "Transport Booking Assigned to You";

        const ctaLine = passengerMode
          ? (psPreset?.bodyLine || "There is an update on your transport booking.")
          : "Please log in to manage this booking.";

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
          <p style="margin:0 0 16px;color:#555;font-size:15px;">${escHtml(ctaLine)}</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
          <p style="margin:0;color:#999;font-size:12px;text-align:center;">Automated notification from Transportation.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

        const textContent = `Hi ${recipientName},\n\n${heading}\n\nJourney: ${journeyLabel}\nPickup: ${pickup}${pickupLocationDescription ? `\nPickup location: ${pickupLocationDescription}` : ""}\nDestination: ${destination}\nDate: ${request_date}${pickup_time ? ` at ${pickup_time}` : ""}${returnLine ? `\n${returnLine}` : ""}\n\n${ctaLine}\n\n${churchName}`;

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
          unsubscribe_token: unsubscribeToken,
          queued_at: new Date().toISOString(),
          ...(tenant_id ? { tenant_id } : {}),
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
          const locLine = pickupLocationDescription ? ` Location: ${pickupLocationDescription}.` : "";

          // Build a compact passenger SMS that fits in a single GSM-7 segment (160 chars).
          const cap = (s: string, n: number) => (s.length > n ? s.slice(0, Math.max(0, n - 1)) + "…" : s);
          let passengerSms = "";
          if (passengerMode) {
            const shortChurch = cap(churchShortName || "Church", 16);
            const shortPickup = cap(pickup || "TBC", 40);
            const shortDesc = pickupLocationDescription ? cap(pickupLocationDescription, 30) : "";
            const shortDriver = driverName ? cap(driverName, 20) : "";
            const dateStr = request_date || "TBC";
            const timeStr = pickup_time ? ` ${pickup_time}` : "";
            const stopStr = stopNumber ? ` Stop #${stopNumber}.` : "";
            const buildSms = (opts: { desc: boolean; stop: boolean; driverPhone: boolean; driverName: boolean }) => {
              const descPart = opts.desc && shortDesc ? ` (${shortDesc})` : "";
              const driverPart = opts.driverName && shortDriver
                ? ` Driver ${shortDriver}${opts.driverPhone && driverPhone ? ` ${driverPhone}` : ""}.`
                : "";
              const stopPart = opts.stop ? stopStr : "";
              return `${shortChurch}: Pickup ${dateStr}${timeStr} from ${shortPickup}${descPart}.${driverPart}${stopPart}`;
            };
            const tries = [
              { desc: true, stop: true, driverPhone: true, driverName: true },
              { desc: false, stop: true, driverPhone: true, driverName: true },
              { desc: false, stop: false, driverPhone: true, driverName: true },
              { desc: false, stop: false, driverPhone: false, driverName: true },
              { desc: false, stop: false, driverPhone: false, driverName: false },
            ];
            for (const t of tries) {
              passengerSms = buildSms(t);
              if (passengerSms.length <= 160) break;
            }
            if (passengerSms.length > 160) passengerSms = passengerSms.slice(0, 159) + "…";
          }

          const smsBody = passengerMode
            ? passengerSms
            : isNewBooking
              ? `Hi ${recipientName}, new transport booking from ${member_name} (${journeyLabel}): ${pickup} → ${destination} on ${request_date}.${locLine}${returnLine ? ` ${returnLine}.` : ""} Please check the system. - ${churchShortName}`
              : `Hi ${recipientName}, you've been assigned a transport booking for ${member_name} (${journeyLabel}): ${pickup} → ${destination} on ${request_date}.${locLine}${returnLine ? ` ${returnLine}.` : ""} - ${churchShortName}`;

          try {
            const webhookUrl = `${supabaseUrl}/functions/v1/twilio-webhook`;
            const __quota = await checkSmsQuota(supabase, tenant_id, "sms", 1);
            if (!__quota.allowed) {
              console.warn("[notify-transport-booking] SMS quota exceeded for tenant", tenant_id, "— skipping send");
            } else {
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
            }
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
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
