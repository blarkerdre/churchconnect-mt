import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  // Verify the caller is authenticated
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Verify user is admin or unit_leader using anon client
  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: userError } = await anonClient.auth.getUser()
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Check role with service client
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey)
  const { data: isAdmin } = await serviceClient.rpc('is_admin', { _user_id: user.id })
  const { data: isLeader } = await serviceClient.rpc('has_role', {
    _user_id: user.id,
    _role: 'unit_leader',
  })

  if (!isAdmin && !isLeader) {
    return new Response(JSON.stringify({ error: 'Forbidden: admin or unit leader required' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { subject, body, audience } = await req.json()

  if (!subject?.trim() || !body?.trim() || !audience?.trim()) {
    return new Response(JSON.stringify({ error: 'subject, body, and audience are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Look up member emails based on audience
  let query = serviceClient.from('members').select('email, first_name, last_name')
    .not('email', 'is', null)
    .neq('email', '')

  if (audience !== 'All Members') {
    // Filter by church_unit containing the audience name
    query = query.ilike('church_unit', `%${audience}%`)
  }

  const { data: members, error: membersError } = await query
  if (membersError) {
    console.error('Failed to fetch members', membersError)
    return new Response(JSON.stringify({ error: 'Failed to fetch member emails' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!members || members.length === 0) {
    return new Response(JSON.stringify({ error: 'No members with email addresses found for this audience', sent: 0 }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Check suppressed emails
  const { data: suppressed } = await serviceClient
    .from('suppressed_emails')
    .select('email')

  const suppressedSet = new Set((suppressed || []).map(s => s.email.toLowerCase()))

  // Build and enqueue emails
  const senderDomain = 'notify.churchmanagementsuite.org'
  const fromAddress = `Winners Chapel Cardiff <noreply@${senderDomain}>`
  let enqueued = 0
  let skipped = 0

  // Build HTML template
  const htmlTemplate = (firstName: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background-color:#1a2d4d;padding:24px 32px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Winners Chapel International Cardiff</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;color:#333333;font-size:16px;">Dear ${firstName},</p>
          <h2 style="margin:0 0 16px;color:#1a2d4d;font-size:18px;">${escHtml(subject)}</h2>
          <div style="margin:0 0 24px;color:#555555;font-size:15px;line-height:1.6;white-space:pre-wrap;">${escHtml(body)}</div>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
          <p style="margin:0;color:#999999;font-size:12px;text-align:center;">This email was sent to ${audience} members.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  for (const member of members) {
    if (!member.email) continue
    const emailLower = member.email.toLowerCase()
    if (suppressedSet.has(emailLower)) {
      skipped++
      continue
    }

    const messageId = `email-alert-${crypto.randomUUID()}`
    const firstName = member.first_name || 'Member'

    const payload = {
      to: member.email,
      from: fromAddress,
      sender_domain: senderDomain,
      subject: subject,
      html: htmlTemplate(firstName),
      text: `Dear ${firstName},\n\n${subject}\n\n${body}\n\nThis email was sent to ${audience} members.\n\nWinners Chapel International Cardiff`,
      purpose: 'transactional',
      label: 'email-alert',
      message_id: messageId,
      idempotency_key: messageId,
      queued_at: new Date().toISOString(),
    }

    // Enqueue to transactional queue
    const { error: enqueueError } = await serviceClient.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload,
    })

    if (enqueueError) {
      console.error('Failed to enqueue email', { to: member.email, error: enqueueError })
      continue
    }

    // Log as pending
    await serviceClient.from('email_send_log').insert({
      message_id: messageId,
      template_name: 'email-alert',
      recipient_email: member.email,
      status: 'pending',
    })

    enqueued++
  }

  return new Response(
    JSON.stringify({ sent: enqueued, skipped, total: members.length }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
