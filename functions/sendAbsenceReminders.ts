import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin' && user?.role !== 'unit_leader') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { session_id } = await req.json();
    if (!session_id) return Response.json({ error: 'session_id required' }, { status: 400 });

    // Get absent records for this session that haven't had reminders sent
    const absentRecords = await base44.asServiceRole.entities.AttendanceRecord.filter({
      session_id,
      status: 'Absent',
      reminder_sent: false,
    });

    let sent = 0;
    for (const record of absentRecords) {
      if (!record.member_email) continue;

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: record.member_email,
        subject: `We missed you at ${record.session_title}`,
        body: `Dear ${record.member_name},\n\nWe noticed you weren't with us at "${record.session_title}" on ${record.session_date}.\n\nWe miss you and hope everything is well. If you need any support or prayer, please don't hesitate to reach out.\n\nGod bless you,\nWinners Chapel Cardiff`,
      });

      await base44.asServiceRole.entities.AttendanceRecord.update(record.id, { reminder_sent: true });
      sent++;
    }

    return Response.json({ success: true, reminders_sent: sent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});