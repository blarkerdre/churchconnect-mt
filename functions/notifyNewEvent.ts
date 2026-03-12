import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event_id } = await req.json();

    if (!event_id) return Response.json({ error: "Missing event_id" }, { status: 400 });

    const event = await base44.asServiceRole.entities.Event.get(event_id);
    if (!event) return Response.json({ error: "Event not found" }, { status: 404 });

    const audience = event.audience || "All Members";
    let members = [];

    if (audience === "All Members") {
      members = await base44.asServiceRole.entities.Member.list("-first_name", 500);
    } else if (audience === "Leaders Only") {
      // Leaders Only — skip member emails (handled by admin)
      return Response.json({ skipped: true, reason: "Leaders Only event – no member emails sent" });
    } else {
      // Get members in the specific unit
      const allMembers = await base44.asServiceRole.entities.Member.list("-first_name", 500);
      members = allMembers.filter(m => (m.church_units || []).includes(audience));
    }

    const emailsToNotify = members.filter(m => m.email).map(m => m.email);
    if (emailsToNotify.length === 0) {
      return Response.json({ skipped: true, reason: "No member emails found for audience" });
    }

    const dateStr = event.date || "TBC";
    const timeStr = event.start_time ? ` at ${event.start_time}` : "";
    const locationStr = event.location ? `\n📍 ${event.location}` : "";

    const subject = `📅 New Event: ${event.title}`;
    const bodyHtml = `
      <p>Dear Member,</p>
      <p>We're excited to announce a new event:</p>
      <h2 style="color:#1e3a5f;">${event.title}</h2>
      <p><strong>Date:</strong> ${dateStr}${timeStr}</p>
      ${event.location ? `<p><strong>Location:</strong> ${event.location}</p>` : ""}
      ${event.end_date ? `<p><strong>Until:</strong> ${event.end_date}</p>` : ""}
      ${event.description ? `<p>${event.description}</p>` : ""}
      ${event.registration_required ? `<p><em>Registration is required for this event. Please contact the church office.</em></p>` : ""}
      <p style="color:#666;font-size:12px;">This notification was sent to ${audience} members.</p>
    `;

    let sent = 0;
    let failed = 0;
    for (const email of emailsToNotify) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: email,
          subject,
          body: bodyHtml,
        });
        sent++;
      } catch {
        failed++;
      }
    }

    return Response.json({ success: true, sent, failed, audience, total_recipients: emailsToNotify.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});