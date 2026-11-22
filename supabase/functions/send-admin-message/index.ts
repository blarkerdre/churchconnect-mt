// Sends a single admin-composed direct message email to one recipient.
// Replaces the browser's previous use of the generic transactional sender:
// the template is fixed here and the caller must be a signed-in user with
// admin rights in the target tenant.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendLoggedTemplateEmail } from '../_shared/managed-email.ts'
import { callerMfaSatisfied, messageContentProblem, messageHash, tenantSuspended, SUSPENDED_MESSAGE } from '../_shared/sender-guard.ts'
import { escapeLike } from '../_shared/like-escape.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TEMPLATE_NAME = 'admin-direct-message'
// Most direct emails one person may receive from the church in 24 hours.
const MAX_PER_RECIPIENT_PER_DAY = 3
// Most direct emails one church admin may send in 24 hours.
const ADMIN_DAILY_DIRECT_EMAIL_LIMIT = 2000
// Direct emails are short personal notes, not newsletters.
const MAX_SUBJECT = 200
const MAX_BODY = 5000

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
  const subject = cleanText(String(templateData.subject || ''), MAX_SUBJECT).replace(/[\r\n]+/g, ' ')
  const messageBody = cleanText(String(templateData.body || ''), MAX_BODY, true)
  if (!subject || !messageBody) {
    return json({ error: 'subject and body are required' }, 400)
  }
  if (subject.length > MAX_SUBJECT || messageBody.length > MAX_BODY) {
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

  // Suspended churches can't send (super-admins excepted).
  let callerSuper = false
  if (userId) {
    const { data: sup } = await admin.rpc('is_super_admin', { _user_id: userId })
    callerSuper = sup === true
  }
  if (!callerSuper && (await tenantSuspended(admin, tenantId))) {
    return json({ error: SUSPENDED_MESSAGE }, 403)
  }

  // Same scam-wording rules as church emails.
  const contentProblem = messageContentProblem(`${subject}\n${messageBody}`, true, 'emails')
  if (contentProblem) return json({ error: contentProblem }, 400)

  // The same email can't go to the same person twice in 24 hours.
  const contentHash = await messageHash(`${recipientEmail}\n${subject}\n${messageBody}`)
  {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: prior, error: priorErr } = await admin
      .from('audit_log')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('entity_type', 'admin_direct_message')
      .gte('created_at', since)
      .contains('details', { hash: contentHash })
      .limit(1)
    if (priorErr) return json({ error: 'Could not check recent emails' }, 500)
    if (prior && prior.length > 0) return json({ error: 'This email was already sent to this person in the last 24 hours.' }, 429)
  }

  // Limit how often one person can be emailed (any wording) and how many
  // direct emails one admin can send per day, so a church login can't be
  // used to bombard someone or blast large numbers of people.
  {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: toRecipient, error: recErr } = await admin
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('entity_type', 'admin_direct_message')
      .gte('created_at', since)
      .contains('details', { recipient: recipientEmail })
    if (recErr) return json({ error: 'Could not check recent emails' }, 500)
    if ((toRecipient || 0) >= MAX_PER_RECIPIENT_PER_DAY) {
      return json({ error: `This person has already been sent ${MAX_PER_RECIPIENT_PER_DAY} direct emails in the last 24 hours.` }, 429)
    }
    if (userId && !callerSuper) {
      const { count: bySender, error: sendErr } = await admin
        .from('audit_log')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('entity_type', 'admin_direct_message')
        .eq('user_id', userId)
        .gte('created_at', since)
      if (sendErr) return json({ error: 'Could not check recent emails' }, 500)
      if ((bySender || 0) >= ADMIN_DAILY_DIRECT_EMAIL_LIMIT) {
        return json({ error: `You've reached the limit of ${ADMIN_DAILY_DIRECT_EMAIL_LIMIT} direct emails in 24 hours. Please try again later.` }, 429)
      }
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
        // The church's name always leads the subject, so a direct email can't
        // pass itself off as coming from a bank, a delivery firm or the app.
        subject: subject.toLowerCase().startsWith(churchName.toLowerCase()) ? subject : `${churchName}: ${subject}`,
        body: messageBody,
        senderIsAdmin: !!userId,
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
      details: { module: 'Communications', recipient: recipientEmail, subject, hash: contentHash },
    }).then(() => {}, (e: unknown) => console.error('audit insert failed', e))
    return json({ sent: true }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('send-admin-message failed', message)
    return json({ error: 'Failed to send email' }, 500)
  }
})
