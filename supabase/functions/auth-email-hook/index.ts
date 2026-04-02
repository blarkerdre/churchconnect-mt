import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { parseEmailWebhookPayload } from 'npm:@lovable.dev/email-js'
import { WebhookError, verifyWebhookRequest } from 'npm:@lovable.dev/webhooks-js'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-lovable-signature, x-lovable-timestamp, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const EMAIL_SUBJECTS: Record<string, string> = {
  signup: 'Confirm your email',
  invite: "You've been invited",
  magiclink: 'Your login link',
  recovery: 'Reset your password',
  email_change: 'Confirm your new email',
  reauthentication: 'Your verification code',
}

const EMAIL_TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
}

// Configuration
const SITE_NAME = "churchconnect-mt"
const SENDER_DOMAIN = "notify.app.churchmanagementsuite.org"
const ROOT_DOMAIN = "app.churchmanagementsuite.org"
const FROM_DOMAIN = "app.churchmanagementsuite.org"

const SAMPLE_PROJECT_URL = "https://churchconnect-mt.lovable.app"
const SAMPLE_EMAIL = "user@example.test"
const SAMPLE_DATA: Record<string, object> = {
  signup: { siteName: SITE_NAME, siteUrl: SAMPLE_PROJECT_URL, recipient: SAMPLE_EMAIL, confirmationUrl: SAMPLE_PROJECT_URL },
  magiclink: { siteName: SITE_NAME, confirmationUrl: SAMPLE_PROJECT_URL },
  recovery: { siteName: SITE_NAME, confirmationUrl: SAMPLE_PROJECT_URL },
  invite: { siteName: SITE_NAME, siteUrl: SAMPLE_PROJECT_URL, confirmationUrl: SAMPLE_PROJECT_URL },
  email_change: { siteName: SITE_NAME, email: SAMPLE_EMAIL, newEmail: SAMPLE_EMAIL, confirmationUrl: SAMPLE_PROJECT_URL },
  reauthentication: { token: '123456' },
}

// Preview endpoint handler
async function handlePreview(req: Request): Promise<Response> {
  const previewCorsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  }
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: previewCorsHeaders })
  }
  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  const authHeader = req.headers.get('Authorization')
  if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }
  let type: string
  try {
    const body = await req.json()
    type = body.type
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
      status: 400, headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const EmailTemplate = EMAIL_TEMPLATES[type]
  if (!EmailTemplate) {
    return new Response(JSON.stringify({ error: `Unknown email type: ${type}` }), {
      status: 400, headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const sampleData = SAMPLE_DATA[type] || {}
  const html = await renderAsync(React.createElement(EmailTemplate, sampleData))
  return new Response(html, {
    status: 200, headers: { ...previewCorsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  })
}

// Tenant resolution helper
async function resolveTenant(supabase: any, payload: any): Promise<{ tenantId: string | null; tenantName: string; tenantSlug: string }> {
  let resolvedTenantId: string | null = null
  let tenantName = ''
  let tenantSlug = ''

  try {
    // 1. Try tenant_memberships
    const { data: membership } = await supabase
      .from('tenant_memberships').select('tenant_id')
      .eq('user_id', payload.data.user_id || '').limit(1).maybeSingle()
    if (membership?.tenant_id) resolvedTenantId = membership.tenant_id

    // 2. Fallback: user_meta_data.tenant_slug (signup case)
    if (!resolvedTenantId) {
      const metaSlug = payload.data.user_meta_data?.tenant_slug
      if (metaSlug) {
        const { data: tenant } = await supabase
          .from('tenants').select('id').eq('slug', metaSlug).limit(1).maybeSingle()
        if (tenant?.id) resolvedTenantId = tenant.id
      }
    }

    // 3. Fallback: profiles.email → tenant_memberships
    if (!resolvedTenantId && payload.data.email) {
      const { data: profile } = await supabase
        .from('profiles').select('user_id').ilike('email', payload.data.email).limit(1).maybeSingle()
      if (profile?.user_id) {
        const { data: mem } = await supabase
          .from('tenant_memberships').select('tenant_id')
          .eq('user_id', profile.user_id).limit(1).maybeSingle()
        if (mem?.tenant_id) resolvedTenantId = mem.tenant_id
      }
    }
  } catch (_) { /* best-effort */ }

  // Resolve tenant name and slug
  if (resolvedTenantId) {
    try {
      const { data: t } = await supabase
        .from('tenants').select('name, slug').eq('id', resolvedTenantId).maybeSingle()
      if (t) {
        tenantName = t.name || ''
        tenantSlug = t.slug || ''
      }
    } catch (_) { /* best-effort */ }
  }

  return { tenantId: resolvedTenantId, tenantName, tenantSlug }
}

// Webhook handler
async function handleWebhook(req: Request): Promise<Response> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  if (!apiKey) {
    console.error('LOVABLE_API_KEY not configured')
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let payload: any
  let run_id = ''
  try {
    const verified = await verifyWebhookRequest({ req, secret: apiKey, parser: parseEmailWebhookPayload })
    payload = verified.payload
    run_id = payload.run_id
  } catch (error) {
    if (error instanceof WebhookError) {
      switch (error.code) {
        case 'invalid_signature': case 'missing_timestamp': case 'invalid_timestamp': case 'stale_timestamp':
          console.error('Invalid webhook signature', { error: error.message })
          return new Response(JSON.stringify({ error: 'Invalid signature' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        case 'invalid_payload': case 'invalid_json':
          console.error('Invalid webhook payload', { error: error.message })
          return new Response(JSON.stringify({ error: 'Invalid webhook payload' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
      }
    }
    console.error('Webhook verification failed', { error })
    return new Response(JSON.stringify({ error: 'Invalid webhook payload' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!run_id) {
    console.error('Webhook payload missing run_id')
    return new Response(JSON.stringify({ error: 'Invalid webhook payload' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (payload.version !== '1') {
    console.error('Unsupported payload version', { version: payload.version, run_id })
    return new Response(JSON.stringify({ error: `Unsupported payload version: ${payload.version}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const emailType = payload.data.action_type
  console.log('Received auth event', { emailType, email: payload.data.email, run_id })

  const EmailTemplate = EMAIL_TEMPLATES[emailType]
  if (!EmailTemplate) {
    console.error('Unknown email type', { emailType, run_id })
    return new Response(JSON.stringify({ error: `Unknown email type: ${emailType}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Create supabase client for tenant resolution and email enqueue
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Resolve tenant for branding
  const { tenantId: resolvedTenantId, tenantName, tenantSlug } = await resolveTenant(supabase, payload)

  const churchName = tenantName || 'Church Connect'
  const tenantSiteUrl = tenantSlug
    ? `https://${ROOT_DOMAIN}/t/${tenantSlug}`
    : `https://${ROOT_DOMAIN}`

  // Build template props — payload.data.url is the correct field from the webhook
  const templateProps: Record<string, any> = {
    siteName: churchName,
    siteUrl: tenantSiteUrl,
    recipient: payload.data.email,
    confirmationUrl: payload.data.url || tenantSiteUrl,
    churchName,
  }

  if (emailType === 'email_change') {
    templateProps.email = payload.data.email
    templateProps.newEmail = payload.data.new_email
  }
  if (emailType === 'reauthentication') {
    templateProps.token = payload.data.token
  }

  console.log('Auth email template props', {
    run_id, emailType, email: payload.data.email,
    confirmationUrl: templateProps.confirmationUrl,
    rawUrl: payload.data.url,
    tenantId: resolvedTenantId, churchName,
  })

  // Render email HTML and plain text
  const html = await renderAsync(React.createElement(EmailTemplate, templateProps))
  const text = await renderAsync(React.createElement(EmailTemplate, templateProps), { plainText: true })

  const messageId = crypto.randomUUID()

  // Log pending BEFORE enqueue
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: emailType,
    recipient_email: payload.data.email,
    status: 'pending',
    ...(resolvedTenantId ? { tenant_id: resolvedTenantId } : {}),
  })

  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'auth_emails',
    payload: {
      run_id,
      message_id: messageId,
      tenant_id: resolvedTenantId,
      to: payload.data.email,
      from: `"${churchName.replace(/"/g, '')}" <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: EMAIL_SUBJECTS[emailType] || 'Notification',
      html,
      text,
      purpose: 'transactional',
      label: emailType,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    console.error('Failed to enqueue auth email', { error: enqueueError, run_id, emailType })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: emailType,
      recipient_email: payload.data.email,
      status: 'failed',
      error_message: 'Failed to enqueue email',
      ...(resolvedTenantId ? { tenant_id: resolvedTenantId } : {}),
    })
    return new Response(JSON.stringify({ error: 'Failed to enqueue email' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log('Auth email enqueued', { emailType, email: payload.data.email, run_id })

  return new Response(
    JSON.stringify({ success: true, queued: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (url.pathname.endsWith('/preview')) {
    return handlePreview(req)
  }
  try {
    return await handleWebhook(req)
  } catch (error) {
    console.error('Webhook handler error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
