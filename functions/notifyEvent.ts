import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const event = body?.data;
    if (!event) {
      return Response.json({ error: "No event data" }, { status: 400 });
    }

    // Only send on create events
    if (body?.event?.type !== "create") {
      return Response.json({ skipped: true });
    }

    const { title, description, category, date, start_time, end_time, location, address, registration_required, audience } = event;

    // Fetch all active members with email
    const allMembers = await base44.asServiceRole.entities.Member.filter({ membership_status: "Active" }, "-created_date", 1000);
    const membersWithEmail = allMembers.filter(m => m.email);

    // Filter by audience
    let recipients;
    if (!audience || audience === "All Members") {
      recipients = membersWithEmail;
    } else if (audience === "Leaders Only") {
      // Leaders only — skip member emails
      return Response.json({ skipped: true, reason: "Leaders Only event" });
    } else {
      recipients = membersWithEmail.filter(m => Array.isArray(m.church_units) && m.church_units.includes(audience));
    }

    if (recipients.length === 0) {
      return Response.json({ sent: 0 });
    }

    const dateStr = date ? new Date(date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Date TBC";
    const timeStr = start_time ? `${start_time}${end_time ? " – " + end_time : ""}` : "";
    const locationStr = [location, address].filter(Boolean).join(", ");

    let sent = 0;
    for (const member of recipients) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: member.email,
        subject: `📅 New Event: ${title}`,
        body: `
Dear ${member.first_name || "Member"},

We're excited to announce a new event at Winners Chapel International Cardiff!

━━━━━━━━━━━━━━━━━━━━━━
${title}
━━━━━━━━━━━━━━━━━━━━━━

📅 Date: ${dateStr}
${timeStr ? `⏰ Time: ${timeStr}` : ""}
${locationStr ? `📍 Venue: ${locationStr}` : ""}
${category ? `🏷️ Category: ${category}` : ""}
${description ? `\n${description}` : ""}
${registration_required ? "\n⚠️ Registration is required for this event." : ""}

━━━━━━━━━━━━━━━━━━━━━━

We look forward to seeing you there!

God bless you,
Winners Chapel International Cardiff
        `.trim(),
      });
      sent++;
    }

    return Response.json({ sent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});