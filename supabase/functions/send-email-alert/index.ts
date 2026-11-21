import { createClient } from 'npm:@supabase/supabase-js@2'
import { writeAudit } from '../_shared/audit.ts';
import { sendRawManagedEmail } from '../_shared/managed-email.ts';
import { callerMfaSatisfied, cleanMessageText } from '../_shared/sender-guard.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildAudienceLabel(filters: Record<string, unknown> | null, audience: string): string {
  if (!filters) return audience || 'All Members';
  const parts: string[] = [];
  if (filters.status) parts.push(String(filters.status));
  if (filters.unit) parts.push(String(filters.unit));
  if (filters.dateFrom || filters.dateTo) {
    const from = filters.dateFrom ? new Date(filters.dateFrom as string).toLocaleDateString() : '...';
    const to = filters.dateTo ? new Date(filters.dateTo as string).toLocaleDateString() : '...';
    parts.push(`registered ${from} – ${to}`);
  }
  return parts.length > 0 ? parts.join(', ') : 'All Members';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

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

  if (!(await callerMfaSatisfied(supabaseUrl, supabaseAnonKey, authHeader))) {
    return new Response(JSON.stringify({ error: 'Two-step verification is required to send messages' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

  const payload = await req.json()
  const { audience, filters, tenant_id, member_ids, audience_label } = payload
  // Plain text only: strip HTML and control characters (no newlines in subject).
  const subject = typeof payload.subject === 'string' ? cleanMessageText(payload.subject, false) : payload.subject
  const body = typeof payload.body === 'string' ? cleanMessageText(payload.body, true) : payload.body

  if (!subject?.trim() || !body?.trim()) {
    return new Response(JSON.stringify({ error: 'subject and body are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (typeof subject !== 'string' || typeof body !== 'string' || subject.length > 200 || body.length > 10000) {
    return new Response(JSON.stringify({ error: 'Subject must be under 200 characters and message under 10,000 characters' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Validate recipient filters: known statuses, short unit names, real dates.
  const MEMBER_STATUSES = ['Active', 'Inactive', 'New Convert', 'First Timer', 'Visitor', 'Bible School']
  const badFilter = (msg: string) => new Response(JSON.stringify({ error: msg }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
  if (filters != null && (typeof filters !== 'object' || Array.isArray(filters))) return badFilter('Invalid filters')
  if (filters?.status != null && !MEMBER_STATUSES.includes(String(filters.status))) return badFilter('Invalid member status')
  if (filters?.unit != null && (typeof filters.unit !== 'string' || filters.unit.length > 100)) return badFilter('Invalid unit')
  for (const k of ['dateFrom', 'dateTo']) {
    const v = filters?.[k]
    if (v != null && (typeof v !== 'string' || Number.isNaN(Date.parse(v)))) return badFilter('Invalid date')
  }
  if (audience != null && (typeof audience !== 'string' || audience.length > 120)) return badFilter('Invalid audience')
  if (audience?.startsWith('status:') && !MEMBER_STATUSES.includes(audience.slice(7))) return badFilter('Invalid member status')
  if (member_ids != null && !Array.isArray(member_ids)) return badFilter('Invalid member_ids')
  // Treat unit names literally (no wildcard characters).
  const likeSafe = (v: string) => v.replace(/[\\%_]/g, (c) => `\\${c}`)

  if (!tenant_id) {
    return new Response(JSON.stringify({ error: 'tenant_id is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Verify user belongs to this tenant
  const { data: belongsToTenant } = await serviceClient.rpc('user_belongs_to_tenant', {
    _user_id: user.id,
    _tenant_id: tenant_id,
  })
  if (!belongsToTenant) {
    return new Response(JSON.stringify({ error: 'Forbidden: not a member of this tenant' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: isAdmin } = await serviceClient.rpc('is_admin', { _user_id: user.id, _tenant_id: tenant_id })
  const { data: isLeader } = await serviceClient.rpc('has_role', {
    _user_id: user.id,
    _role: 'unit_leader',
    _tenant_id: tenant_id,
  })

  if (!isAdmin && !isLeader) {
    return new Response(JSON.stringify({ error: 'Forbidden: admin or unit leader required' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Unit leaders (non-admins) may only email members of the units they lead.
  let leaderUnits: string[] | null = null
  if (!isAdmin) {
    const { data: assignments } = await serviceClient
      .from('unit_leader_assignments')
      .select('unit_name')
      .eq('user_id', user.id)
      .eq('tenant_id', tenant_id)
    leaderUnits = (assignments || []).map((a: { unit_name: string }) => String(a.unit_name || '').trim().toLowerCase()).filter(Boolean)
    if (leaderUnits.length === 0) {
      return new Response(JSON.stringify({ error: 'Forbidden: you are not assigned to lead any unit' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  // Fetch tenant settings for sender name
  let tenantSenderName = 'Winners Chapel International Cardiff'
  if (tenant_id) {
    const { data: tenantRow } = await serviceClient
      .from('tenants')
      .select('name, settings')
      .eq('id', tenant_id)
      .single()
    if (tenantRow) {
      const s = tenantRow.settings as Record<string, unknown> | null
      tenantSenderName = (s?.email_sender_name as string) || tenantRow.name || tenantSenderName
    }
  }

  // Every email names the person who wrote it, so members can see who it is
  // from and reply to them directly.
  const { data: senderProfile } = await serviceClient
    .from('profiles').select('full_name, email').eq('user_id', user.id).maybeSingle()
  const senderName = cleanMessageText(senderProfile?.full_name || user.email || 'a church leader', false).slice(0, 120)
  const senderEmail = senderProfile?.email || user.email || undefined
  const senderRoleLabel = isAdmin ? 'church admin' : 'unit leader'

  // Build member query based on explicit IDs, filters, or legacy audience
  let query = serviceClient.from('members').select('email, first_name, last_name, church_unit')
    .not('email', 'is', null)
    .neq('email', '')
    .eq('tenant_id', tenant_id)

  if (Array.isArray(member_ids) && member_ids.length > 0) {
    // Explicit member-id targeting (used by report-driven sends)
    const safeIds = member_ids.filter((id: unknown) => typeof id === 'string').slice(0, 5000)
    if (safeIds.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid member_ids provided', sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    query = query.in('id', safeIds)
  } else if (filters && (filters.status || filters.unit || filters.dateFrom || filters.dateTo)) {
    // New filters-based approach
    if (filters.status) {
      query = query.eq('membership_status', filters.status)
    }
    if (filters.unit) {
      query = query.ilike('church_unit', `%${likeSafe(filters.unit)}%`)
    }
    if (filters.dateFrom) {
      query = query.gte('created_at', filters.dateFrom)
    }
    if (filters.dateTo) {
      query = query.lte('created_at', filters.dateTo)
    }
  } else if (audience) {
    // Legacy audience-based approach
    if (audience.startsWith('status:')) {
      const statusValue = audience.replace('status:', '')
      query = query.eq('membership_status', statusValue)
    } else if (audience !== 'All Members') {
      query = query.ilike('church_unit', `%${likeSafe(audience)}%`)
    }
  }

  const { data: fetchedMembers, error: membersError } = await query
  const members = leaderUnits
    ? (fetchedMembers || []).filter((m: { church_unit: string | null }) => {
        const units = String(m.church_unit || '').toLowerCase().split(',').map((u) => u.trim())
        return units.some((u) => leaderUnits!.includes(u))
      })
    : fetchedMembers
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

  const audienceLabel = (typeof audience_label === 'string' && audience_label.trim())
    ? cleanMessageText(audience_label, false).slice(0, 120)
    : buildAudienceLabel(filters, audience)

  // Build and enqueue emails
  let enqueued = 0
  let skipped = 0

  const htmlTemplate = (firstName: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background-color:#1a2d4d;padding:24px 32px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${escHtml(tenantSenderName)}</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;color:#333333;font-size:16px;">Dear ${escHtml(firstName)},</p>
          <h2 style="margin:0 0 16px;color:#1a2d4d;font-size:18px;">${escHtml(subject)}</h2>
          <div style="margin:0 0 24px;color:#555555;font-size:15px;line-height:1.6;white-space:pre-wrap;">${escHtml(body)}</div>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
          <p style="margin:0 0 6px;color:#999999;font-size:12px;text-align:center;">Sent by ${escHtml(senderName)} (${senderRoleLabel}) at ${escHtml(tenantSenderName)}.</p>
          <p style="margin:0;color:#999999;font-size:12px;text-align:center;">This email was sent to ${escHtml(audienceLabel)} members.</p>
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

    try {
      await sendRawManagedEmail({
        supabase: serviceClient,
        to: member.email,
        subject: subject,
        html: htmlTemplate(firstName),
        text: `Dear ${firstName},\n\n${subject}\n\n${body}\n\nSent by ${senderName} (${senderRoleLabel}) at ${tenantSenderName}.\nThis email was sent to ${audienceLabel} members.\n\n${tenantSenderName}`,
        replyTo: senderEmail,
        label: 'email-alert',
        idempotencyKey: messageId,
        tenantId: tenant_id,
        messageId,
        fromName: tenantSenderName,
      })
    } catch (sendErr) {
      console.error('Failed to send email', { error: sendErr })
      continue
    }

    enqueued++
  }

  await writeAudit(serviceClient, {
    tenant_id: tenant_id ?? null,
    user_id: user?.id ?? null,
    action: 'email_sent',
    entity_type: 'email_send_log',
    details: {
      channel: 'email',
      audience_label: audienceLabel,
      recipients_count: members.length,
      success_count: enqueued,
      skipped_count: skipped,
      subject,
      source: 'send-email-alert',
      sender_name: senderName,
    },
  })

  return new Response(
    JSON.stringify({ sent: enqueued, skipped, total: members.length }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
