import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Pushes pending tenant_overage_charges to Stripe as one-off invoice items
// against the tenant's Stripe customer. Run before the next subscription
// invoice finalizes so Stripe bills the overage automatically.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "STRIPE_SECRET_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" as any });

    const body = await req.json().catch(() => ({}));
    const tenantFilter = body?.tenant_id;

    let query = admin.from("tenant_overage_charges").select("*").eq("status", "pending");
    if (tenantFilter) query = query.eq("tenant_id", tenantFilter);
    const { data: charges, error } = await query;
    if (error) throw error;

    const results: any[] = [];

    for (const charge of charges || []) {
      const { data: sub } = await admin
        .from("tenant_subscriptions")
        .select("stripe_customer_id, payment_mode")
        .eq("tenant_id", charge.tenant_id)
        .maybeSingle();

      if (!sub?.stripe_customer_id || sub.payment_mode !== "stripe") {
        results.push({ id: charge.id, skipped: "not stripe tenant" });
        continue;
      }

      const amountMinor = Math.round(Number(charge.amount) * 100);
      if (amountMinor <= 0) continue;

      const item = await stripe.invoiceItems.create({
        customer: sub.stripe_customer_id,
        amount: amountMinor,
        currency: (charge.currency || "GBP").toLowerCase(),
        description: `Overage ${charge.metric} — ${charge.period_start} (${charge.quantity})`,
        metadata: {
          tenant_id: charge.tenant_id,
          metric: charge.metric,
          period_start: charge.period_start,
          overage_charge_id: charge.id,
        },
      });

      await admin.from("tenant_overage_charges").update({
        status: "reported_to_stripe",
        stripe_invoice_item_id: item.id,
      }).eq("id", charge.id);

      results.push({ id: charge.id, stripe_invoice_item_id: item.id });
    }

    return new Response(JSON.stringify({ ok: true, count: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("report-stripe-overage error", err);
    return new Response(JSON.stringify({ error: String((err as Error)?.message || err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
