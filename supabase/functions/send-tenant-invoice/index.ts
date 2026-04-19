import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('Authorization') || ''
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const userId = userData.user.id

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'super_admin')
      .maybeSingle()
    if (!roleRow) {
      return new Response(JSON.stringify({ error: 'Forbidden — super_admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { invoice_id, recipient_email } = await req.json()
    if (!invoice_id) {
      return new Response(JSON.stringify({ error: 'invoice_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: invoice, error: invErr } = await admin
      .from('tenant_invoices')
      .select('*, tenant:tenants(id, name, contact_email, settings)')
      .eq('id', invoice_id)
      .maybeSingle()
    if (invErr || !invoice) {
      return new Response(JSON.stringify({ error: 'Invoice not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const billTo = invoice.bill_to || {}
    const recipient = recipient_email || billTo.email || invoice.tenant?.contact_email
    if (!recipient) {
      return new Response(JSON.stringify({ error: 'No recipient email available' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build template data
    const templateData = {
      documentType: invoice.document_type,
      invoiceNumber: invoice.invoice_number,
      churchName: invoice.tenant?.name || 'Your Church',
      billToName: billTo.name || invoice.tenant?.name || '',
      billToEmail: billTo.email || '',
      billToAddress: billTo.address || '',
      issueDate: invoice.issue_date,
      dueDate: invoice.due_date,
      currency: invoice.currency,
      lineItems: invoice.line_items || [],
      subtotal: Number(invoice.subtotal).toFixed(2),
      taxAmount: Number(invoice.tax_amount).toFixed(2),
      total: Number(invoice.total).toFixed(2),
      notes: invoice.notes || '',
      terms: invoice.terms || '',
      payUrl: `${supabaseUrl.replace(/\/$/, '')}`.includes('lovable')
        ? 'https://app.churchmanagementsuite.org/settings'
        : 'https://app.churchmanagementsuite.org/settings',
      status: invoice.status,
    }

    // Invoke send-transactional-email
    const sendRes = await admin.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'tenant-invoice',
        recipientEmail: recipient,
        idempotencyKey: `tenant-invoice-${invoice.id}-${invoice.status}`,
        tenant_id: invoice.tenant_id,
        templateData,
      },
    })

    if (sendRes.error) {
      console.error('send-transactional-email failed', sendRes.error)
      return new Response(JSON.stringify({ error: 'Failed to send email', details: sendRes.error }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Update invoice status
    await admin
      .from('tenant_invoices')
      .update({
        status: invoice.document_type === 'receipt' ? 'paid' : 'sent',
        sent_at: new Date().toISOString(),
        sent_to: recipient,
      })
      .eq('id', invoice_id)

    return new Response(JSON.stringify({ success: true, recipient }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('send-tenant-invoice error', err)
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
