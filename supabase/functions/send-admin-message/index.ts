// Sends a single admin-composed direct message email to one recipient.
// Replaces the browser's previous use of the generic transactional sender:
// the template is fixed here and the caller must be a signed-in user with
// admin rights in the target tenant.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendLoggedTemplateEmail } from '../_shared/managed-email.ts'
import { callerMfaSatisfied } from '../_shared/sender-guard.ts'
import { escapeLike } from '../_shared/like-escape.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TEMPLATE_NAME = 'admin-direct-message'

// Strip control characters and HTML tags; keep newlines only where allowed.
function cleanText(v: string, max: number, keepNewlines = false): string {
  let s = v.replace(keepNewlines ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, '')
  s = s.replace(/<[^>]*>/g, '').trim()
  return s.length > max ? s.slice(0, max + 1) : s
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Server configuration error' }, 500)
  }

  const authHeader = req.headers.get('Authorization') || ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!bearer || bearer === anonKey) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const admin = createClient(supabaseUrl, serviceKey)

  let userId: string | null = null
  if (bearer === serviceKey) {
    userId = null // internal service caller
  } else {
    const { data, error } = await admin.auth.getUser(bearer)
    if (error || !data?.user) return json({ error: 'Unauthorized' }, 401)
    userId = data.user.id
    if (!(await callerMfaSatisfied(supabaseUrl, anonKey, authHeader))) {
      return json({ error: 'Two-step verification is required to send messages' }, 403)
    }
  }

  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const recipientEmail = String(body.recipientEmail || '').trim().toLowerCase()
  const tenantId = body.tenant_id ? String(body.tenant_id) : null
  const templateData = (body.templateData ?? {}) as Record<string, unknown>
  const idempotencyKey = body.idempotencyKey ? String(body.idempotencyKey) : undefined

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipientEmail)) {
    return json({ error: 'Valid recipientEmail is required' }, 400)
  }
  if (!tenantId) {
    return json({ error: 'tenant_id is required' }, 400)
  }
  const subject = cleanText(String(templateData.subject || ''), 300).replace(/[\r\n]+/g, ' ')
  const messageBody = cleanText(String(templateData.body || ''), 20000, true)
  if (!subject || !messageBody) {
    return json({ error: 'subject and body are required' }, 400)
  }
  if (subject.length > 300 || messageBody.length > 20000) {
    return json({ error: 'Message is too long' }, 400)
  }

  // Authorization: the caller must administer the target tenant.
  if (userId) {
    const { data: roleRows, error: roleError } = await admin
      .from('tenant_memberships')
      .select('role')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .limit(5)
    if (roleError) {
      console.error('Role lookup failed', roleError.message)
      return json({ error: 'Authorization check failed' }, 500)
    }
    const roles = (roleRows || []).map((r: any) => String(r.role))
    const allowed = roles.some((r) => ['owner', 'admin'].includes(r))
    if (!allowed) {
      const { data: isSuper } = await admin.rpc('is_super_admin', { _user_id: userId })
      if (!isSuper) return json({ error: 'Forbidden' }, 403)
    }
  }

  // Recipient must be someone already on record for this church. The
  // recipient's name comes from that record, not from the request.
  let recipientName = 'Friend'
  {
    const [m, f, c] = await Promise.all([
      admin.from('members').select('id, first_name').eq('tenant_id', tenantId).ilike('email', escapeLike(recipientEmail)).limit(1),
      admin.from('first_timers').select('id, first_name').eq('tenant_id', tenantId).ilike('email', escapeLike(recipientEmail)).limit(1),
      admin.from('contacts').select('id, first_name').eq('tenant_id', tenantId).ilike('email', escapeLike(recipientEmail)).limit(1),
    ])
    const row: any = m.data?.[0] || f.data?.[0] || c.data?.[0]
    if (!row) return json({ error: 'Recipient is not on record for this church' }, 403)
    const nm = String(row.first_name || '').trim()
    if (nm) recipientName = cleanText(nm, 100)
  }

  // Church and sender names are resolved server-side so the caller only
  // controls the subject and message text.
  const { data: tenantRow } = await admin
    .from('tenants')
    .select('name, is_archived')
    .eq('id', tenantId)
    .maybeSingle()
  if (!tenantRow || tenantRow.is_archived) return json({ error: 'Church not found' }, 404)
  const churchName = cleanText(String(tenantRow.name || ''), 150) || 'Our Church'

  let senderName = ''
  if (userId) {
    const { data: prof } = await admin
      .from('profiles')
      .select('full_name')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()
    senderName = cleanText(String(prof?.full_name || ''), 120)
  } else {
    senderName = cleanText(String(templateData.senderName || ''), 120)
  }

  try {
    const result = await sendLoggedTemplateEmail({
      supabase: admin,
      templateName: TEMPLATE_NAME,
      to: recipientEmail,
      templateData: {
        recipientName,
        churchName,
        senderName,
        subject,
        body: messageBody,
      },
      idempotencyKey,
      tenantId,
    })
    if (!result.sent) {
      return json({ sent: false, reason: result.reason }, 200)
    }
    // Record who sent what to whom, for accountability.
    await admin.from('audit_log').insert({
      action: 'email_sent',
      entity_type: 'admin_direct_message',
      user_id: userId,
      tenant_id: tenantId,
      details: { module: 'Communications', recipient: recipientEmail, subject },
    }).then(() => {}, (e: unknown) => console.error('audit insert failed', e))
    return json({ sent: true }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('send-admin-message failed', message)
    return json({ error: 'Failed to send email' }, 500)
  }
})
