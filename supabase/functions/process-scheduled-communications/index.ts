import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const client = createClient(supabaseUrl, serviceKey)

  // Fetch due scheduled communications
  const { data: scheduled, error: fetchErr } = await client
    .from('scheduled_communications')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .limit(20)

  if (fetchErr) {
    console.error('Failed to fetch scheduled communications', fetchErr)
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!scheduled || scheduled.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let processed = 0

  for (const item of scheduled) {
    try {
      // Mark as processing
      await client
        .from('scheduled_communications')
        .update({ status: 'processing' })
        .eq('id', item.id)

      if (item.channel === 'email') {
        // Invoke send-email-alert
        const res = await fetch(`${supabaseUrl}/functions/v1/send-email-alert`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            subject: item.subject,
            body: item.message,
            tenant_id: item.tenant_id,
            filters: item.filters || {},
          }),
        })

        const result = await res.json()
        if (!res.ok || result.error) {
          throw new Error(result.error || 'Email send failed')
        }

        await client
          .from('scheduled_communications')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', item.id)
      } else {
        // SMS or WhatsApp — query members then invoke send-sms
        const filters = (item.filters || {}) as Record<string, unknown>
        let query = client
          .from('members')
          .select('id, phone')
          .eq('tenant_id', item.tenant_id)
          .not('phone', 'is', null)
          .neq('phone', '')

        if (filters.status) query = query.eq('membership_status', filters.status as string)
        if (filters.unit) query = query.ilike('church_unit', `%${filters.unit}%`)
        if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom as string)
        if (filters.dateTo) query = query.lte('created_at', filters.dateTo as string)

        const { data: members, error: membersErr } = await query
        if (membersErr) throw membersErr

        if (!members || members.length === 0) {
          await client
            .from('scheduled_communications')
            .update({ status: 'sent', sent_at: new Date().toISOString(), error_message: 'No recipients found' })
            .eq('id', item.id)
          processed++
          continue
        }

        const recipients = members
          .filter((m: { phone: string | null }) => m.phone && m.phone.trim())
          .map((m: { id: string; phone: string }) => ({ phone: m.phone, member_id: m.id }))

        const res = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            recipients,
            message: item.message,
            sms_type: 'scheduled',
            channel: item.channel,
            tenant_id: item.tenant_id,
          }),
        })

        const result = await res.json()
        if (!res.ok) throw new Error(result.error || 'SMS send failed')

        await client
          .from('scheduled_communications')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', item.id)
      }

      processed++
    } catch (err) {
      console.error(`Failed to process scheduled communication ${item.id}`, err)
      await client
        .from('scheduled_communications')
        .update({ status: 'failed', error_message: (err as Error).message })
        .eq('id', item.id)
    }
  }

  return new Response(
    JSON.stringify({ processed }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
