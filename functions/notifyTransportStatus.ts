import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { booking_id, new_status } = await req.json();

    if (!booking_id || !new_status) {
      return Response.json({ error: "Missing booking_id or new_status" }, { status: 400 });
    }

    // Only notify for Confirmed or Cancelled
    if (!["Confirmed", "Cancelled"].includes(new_status)) {
      return Response.json({ skipped: true, reason: "Status not notification-worthy" });
    }

    const booking = await base44.asServiceRole.entities.Transportation.get(booking_id);
    if (!booking) return Response.json({ error: "Booking not found" }, { status: 404 });

    // Find member email
    let memberEmail = null;
    let memberName = booking.member_name;

    if (booking.member_id) {
      const members = await base44.asServiceRole.entities.Member.filter({ id: booking.member_id });
      if (members[0]?.email) memberEmail = members[0].email;
    }
    if (!memberEmail) {
      // Try to find by name
      const found = await base44.asServiceRole.entities.Member.filter({ first_name: memberName.split(" ")[0] });
      const match = found.find(m => `${m.first_name} ${m.last_name}` === memberName);
      if (match?.email) memberEmail = match.email;
    }

    if (!memberEmail) {
      return Response.json({ skipped: true, reason: "No email found for member" });
    }

    const isConfirmed = new_status === "Confirmed";
    const subject = isConfirmed
      ? `✅ Transport Booking Confirmed – ${booking.date}`
      : `❌ Transport Booking Cancelled – ${booking.date}`;

    const body = isConfirmed
      ? `<p>Dear ${memberName},</p>
         <p>Your transport booking has been <strong>confirmed</strong>. Here are the details:</p>
         <ul>
           <li><strong>Date:</strong> ${booking.date} at ${booking.time}</li>
           <li><strong>Pickup:</strong> ${booking.pickup_address}</li>
           <li><strong>Destination:</strong> ${booking.destination}</li>
           <li><strong>Passengers:</strong> ${booking.passengers}</li>
           ${booking.driver_name ? `<li><strong>Driver:</strong> ${booking.driver_name}</li>` : ""}
           ${booking.vehicle ? `<li><strong>Vehicle:</strong> ${booking.vehicle}</li>` : ""}
         </ul>
         <p>Please be ready at your pickup location on time. God bless you!</p>`
      : `<p>Dear ${memberName},</p>
         <p>We regret to inform you that your transport booking for <strong>${booking.date} at ${booking.time}</strong> has been <strong>cancelled</strong>.</p>
         <p>Pickup: ${booking.pickup_address} → ${booking.destination}</p>
         ${booking.notes ? `<p>Note: ${booking.notes}</p>` : ""}
         <p>Please contact the Transportation team for assistance. We apologise for any inconvenience.</p>`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: memberEmail,
      subject,
      body,
    });

    return Response.json({ success: true, email_sent_to: memberEmail, status: new_status });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});