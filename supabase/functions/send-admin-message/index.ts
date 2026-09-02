// Sends a single admin-composed direct message email to one recipient.
// Replaces the browser's previous use of the generic transactional sender:
// the template is fixed here and the caller must be a signed-in user with
// admin rights in the target tenant.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendLoggedTemplateEmail } from '../_shared/managed-email.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TEMPLATE_NAME = 'admin-direct-message'

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
  const subject = String(templateData.subject || '').trim()
  const messageBody = String(templateData.body || '').trim()
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
    const allowed = roles.some((r) => ['owner', 'admin', 'pastor', 'super_admin'].includes(r))
    if (!allowed) {
      const { data: isSuper } = await admin.rpc('is_super_admin', { _user_id: userId })
      if (!isSuper) return json({ error: 'Forbidden' }, 403)
    }
  }

  try {
    const result = await sendLoggedTemplateEmail({
      supabase: admin,
      templateName: TEMPLATE_NAME,
      to: recipientEmail,
      templateData: {
        ...templateData,
        subject,
        body: messageBody,
      },
      idempotencyKey,
      tenantId,
    })
    if (!result.sent) {
      return json({ sent: false, reason: result.reason }, 200)
    }
    return json({ sent: true }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('send-admin-message failed', message)
    return json({ error: 'Failed to send email' }, 500)
  }
})
