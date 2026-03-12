import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const announcement = body?.data;
    if (!announcement) {
      return Response.json({ error: "No announcement data" }, { status: 400 });
    }

    // Only send on create events, not updates
    if (body?.event?.type !== "create") {
      return Response.json({ skipped: true });
    }

    const { title, body: content, audience, author_name } = announcement;

    // Fetch all active members with email addresses
    const allMembers = await base44.asServiceRole.entities.Member.filter({ membership_status: "Active" }, "-created_date", 1000);
    const membersWithEmail = allMembers.filter(m => m.email);

    // Filter by audience
    let recipients = [];
    if (audience === "All Members" || audience === "Leaders Only") {
      recipients = membersWithEmail;
    } else {
      // Filter to members who belong to the target unit
      recipients = membersWithEmail.filter(m =>
        Array.isArray(m.church_units) && m.church_units.includes(audience)
      );
    }

    if (recipients.length === 0) {
      return Response.json({ sent: 0 });
    }

    // Send email to each recipient
    let sent = 0;
    for (const member of recipients) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: member.email,
        subject: `📢 ${title}`,
        body: `
Dear ${member.first_name || "Member"},

A new announcement has been posted by ${author_name || "the leadership"}:

━━━━━━━━━━━━━━━━━━━━━━
${title}
━━━━━━━━━━━━━━━━━━━━━━

${content}

━━━━━━━━━━━━━━━━━━━━━━

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