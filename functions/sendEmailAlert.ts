import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role !== 'admin' && user.role !== 'unit_leader')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { subject, body, audience } = await req.json();

    if (!subject || !body || !audience) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch all members with emails
    const allMembers = await base44.asServiceRole.entities.Member.list();
    
    let recipients = [];

    if (audience === 'All Members') {
      recipients = allMembers.filter(m => m.email);
    } else {
      // Filter by church unit
      recipients = allMembers.filter(m => m.email && m.church_units && m.church_units.includes(audience));
    }

    if (recipients.length === 0) {
      return Response.json({ success: true, sent: 0, message: 'No recipients found for this audience.' });
    }

    let sent = 0;
    const errors = [];

    for (const member of recipients) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: member.email,
          subject,
          body: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <h2 style="color:#1e3a5f">${subject}</h2>
            <div style="color:#334155;line-height:1.6">${body.replace(/\n/g, '<br/>')}</div>
            <hr style="margin:24px 0;border-color:#e2e8f0"/>
            <p style="color:#94a3b8;font-size:12px">Winners Chapel International Cardiff</p>
          </div>`,
          from_name: 'Winners Chapel Cardiff'
        });
        sent++;
      } catch (e) {
        errors.push(`${member.email}: ${e.message}`);
      }
    }

    return Response.json({ success: true, sent, total: recipients.length, errors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});