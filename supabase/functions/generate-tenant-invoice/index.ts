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

    // AuthN: forward caller JWT to validate identity
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

    // AuthZ: super admin only
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

    const body = await req.json()
    const {
      tenant_id,
      document_type,
      payment_id,
      subscription_id,
      line_items: providedLineItems,
      due_date: providedDueDate,
      notes,
      terms,
      bill_to: providedBillTo,
    } = body || {}

    if (!tenant_id || !['invoice', 'receipt'].includes(document_type)) {
      return new Response(JSON.stringify({ error: 'tenant_id and valid document_type required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Load tenant for bill-to defaults
    const { data: tenant, error: tenantErr } = await admin
      .from('tenants')
      .select('id, name, settings')
      .eq('id', tenant_id)
      .maybeSingle()
    if (tenantErr || !tenant) {
      console.error('Tenant lookup failed', { tenant_id, tenantErr })
      return new Response(JSON.stringify({ error: 'Tenant not found', detail: tenantErr?.message }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const tenantSettings = (tenant.settings && typeof tenant.settings === 'object') ? tenant.settings : {}
    const tenantContactEmail = tenantSettings.contact_email || tenantSettings.billing_email || ''

    // Load subscription (for currency / amount defaults)
    let subscription = null
    if (subscription_id) {
      const { data } = await admin.from('tenant_subscriptions').select('*').eq('id', subscription_id).maybeSingle()
      subscription = data
    } else {
      const { data } = await admin.from('tenant_subscriptions').select('*').eq('tenant_id', tenant_id).maybeSingle()
      subscription = data
    }

    // Load payment (for receipts)
    let payment = null
    if (payment_id) {
      const { data } = await admin.from('tenant_payments').select('*').eq('id', payment_id).maybeSingle()
      payment = data
    }

    // Build defaults
    const currency = payment?.currency || subscription?.currency || 'GBP'
    let lineItems = providedLineItems
    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      if (document_type === 'receipt' && payment) {
        lineItems = [{
          description: `Subscription payment — ${payment.payment_date}`,
          quantity: 1,
          unit_price: Number(payment.amount) || 0,
          amount: Number(payment.amount) || 0,
        }]
      } else if (document_type === 'invoice' && subscription) {
        const items = [{
          description: `${subscription.billing_cycle === 'yearly' ? 'Yearly' : 'Monthly'} Subscription`,
          quantity: 1,
          unit_price: Number(subscription.amount) || 0,
          amount: Number(subscription.amount) || 0,
        }]
        if (Number(subscription.setup_fee_amount) > 0 && !subscription.setup_fee_paid) {
          items.push({
            description: 'Setup Fee (one-time)',
            quantity: 1,
            unit_price: Number(subscription.setup_fee_amount),
            amount: Number(subscription.setup_fee_amount),
          })
        }
        lineItems = items
      } else {
        lineItems = []
      }
    }

    const subtotal = lineItems.reduce((sum, li) => sum + (Number(li.amount) || 0), 0)
    const taxAmount = 0
    const total = subtotal + taxAmount

    const issueDate = new Date().toISOString().split('T')[0]
    const dueDate = providedDueDate || (
      document_type === 'invoice'
        ? (subscription?.next_due_date || null)
        : null
    )

    const billTo = providedBillTo || {
      name: tenant.name,
      email: tenantContactEmail,
      address: '',
      contact_name: '',
    }

    // Generate invoice number
    const { data: invoiceNumberData, error: numberErr } = await admin.rpc('next_invoice_number', {
      _tenant_id: tenant_id,
      _doc_type: document_type,
    })
    if (numberErr || !invoiceNumberData) {
      console.error('Failed to generate invoice number', numberErr)
      return new Response(JSON.stringify({ error: 'Failed to generate invoice number' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const insertPayload = {
      tenant_id,
      subscription_id: subscription?.id || null,
      payment_id: payment?.id || null,
      document_type,
      invoice_number: invoiceNumberData,
      status: document_type === 'receipt' ? 'paid' : 'draft',
      issue_date: issueDate,
      due_date: dueDate,
      currency,
      subtotal,
      tax_amount: taxAmount,
      total,
      line_items: lineItems,
      bill_to: billTo,
      notes: notes || null,
      terms: terms || null,
      created_by: userId,
    }

    const { data: invoice, error: insertErr } = await admin
      .from('tenant_invoices')
      .insert(insertPayload)
      .select()
      .single()

    if (insertErr) {
      console.error('Insert failed', insertErr)
      return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ invoice }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('generate-tenant-invoice error', err)
    return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
