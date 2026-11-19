import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { resolveSmsUnitPrice } from "../_shared/sms-quota.ts";

const ALLOWED_ORIGINS = [
  "https://churchconnect-mt.lovable.app",
  "https://app.churchmanagementsuite.org",
  "https://id-preview--1edfff3c-782e-429b-b0ad-97087fdfd80e.lovable.app",
];
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  try {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ error: "Not signed in" }, 401);
    const body = await req.json().catch(() => ({}));
    const tenantId = typeof body.tenant_id === "string" ? body.tenant_id : "";
    const quantity = Math.floor(Number(body.quantity));
    if (!/^[0-9a-f-]{36}$/i.test(tenantId) || !Number.isFinite(quantity) || quantity < 10 || quantity > 100000) {
      return json({ error: "Choose between 10 and 100,000 texts" }, 400);
    }
    const { data: m } = await admin.from("tenant_memberships").select("role").eq("tenant_id", tenantId).eq("user_id", u.user.id).maybeSingle();
    if (!m || !["owner", "admin"].includes(m.role)) return json({ error: "Only church owners or admins can buy texts" }, 403);

    const { data: tenant } = await admin.from("tenants").select("name, pricing_plan_id, sms_unit_price_override").eq("id", tenantId).single();
    let planPrice = 0, currency = "GBP";
    if (tenant?.pricing_plan_id) {
      const { data: plan } = await admin.from("pricing_plans").select("overage_price_sms, currency").eq("id", tenant.pricing_plan_id).maybeSingle();
      planPrice = Number(plan?.overage_price_sms || 0); currency = plan?.currency || "GBP";
    }
    const unitPrice = resolveSmsUnitPrice(tenant?.sms_unit_price_override, planPrice);
    if (unitPrice <= 0) return json({ error: "No price per text is set for your church yet. Please contact support." }, 400);
    const amountMinor = Math.round(unitPrice * quantity * 100);
    if (amountMinor < 50) return json({ error: "Top-up total is too small. Choose more texts." }, 400);

    const { data: sub } = await admin.from("tenant_subscriptions").select("stripe_customer_id").eq("tenant_id", tenantId).maybeSingle();
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    const reqOrigin = req.headers.get("origin") || "";
    const origin = ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : "https://app.churchmanagementsuite.org";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ...(sub?.stripe_customer_id ? { customer: sub.stripe_customer_id } : { customer_email: u.user.email }),
      line_items: [{
        price_data: { currency: currency.toLowerCase(), product_data: { name: `SMS top-up: ${quantity} texts (${tenant?.name || "Church"})` }, unit_amount: amountMinor },
        quantity: 1,
      }],
      metadata: { type: "sms_topup", tenant_id: tenantId, quantity: String(quantity) },
      success_url: `${origin}/settings?sms_topup=success`,
      cancel_url: `${origin}/settings?sms_topup=cancelled`,
    });
    await admin.from("sms_topups").insert({
      tenant_id: tenantId, quantity, unit_price: unitPrice, amount: amountMinor / 100, currency,
      stripe_session_id: session.id, status: "pending", created_by: u.user.id,
    });
    return json({ url: session.url });
  } catch (e) {
    console.error("[create-sms-topup-checkout]", e);
    return json({ error: "Could not start payment. Please try again." }, 500);
  }
});
