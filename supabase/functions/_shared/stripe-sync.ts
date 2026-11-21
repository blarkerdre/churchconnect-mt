// Shared logic for applying Stripe subscription events to a church.
// Used by the Stripe webhook, the post-checkout check and the daily catch-up sync,
// so each route behaves the same and a payment is only ever recorded once.
import type Stripe from "npm:stripe@18.5.0";
import { sendLoggedTemplateEmail } from "./managed-email.ts";

const log = (step: string, d?: unknown) => console.log(`[stripe-sync] ${step}${d ? " - " + JSON.stringify(d) : ""}`);

// Newer Stripe API versions moved the subscription id off the invoice.
export function invoiceSubscriptionId(inv: any): string | null {
  return inv?.subscription || inv?.parent?.subscription_details?.subscription || null;
}

async function admins(db: any, tenantId: string) {
  const { data } = await db.from("tenant_memberships").select("user_id").eq("tenant_id", tenantId).in("role", ["owner", "admin"]);
  return data || [];
}

export async function linkSubscription(db: any, sub: Stripe.Subscription) {
  const tenantId = sub.metadata?.tenant_id;
  if (!tenantId) return;
  const payload: Record<string, unknown> = {
    stripe_subscription_id: sub.id,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
    payment_mode: "stripe",
  };
  if (sub.items?.data?.[0]?.price?.id) payload.stripe_price_id = sub.items.data[0].price.id;
  if (sub.metadata?.setup_fee_charged === "true") { payload.setup_fee_paid = true; payload.setup_fee_paid_at = new Date().toISOString(); }
  let q = db.from("tenant_subscriptions").update(payload).eq("tenant_id", tenantId);
  q = sub.metadata?.subscription_id ? q.eq("id", sub.metadata.subscription_id) : q.eq("is_active", true);
  const { error } = await q;
  if (error && String(error.message).includes("payment_mode")) {
    delete payload.payment_mode;
    let q2 = db.from("tenant_subscriptions").update(payload).eq("tenant_id", tenantId);
    q2 = sub.metadata?.subscription_id ? q2.eq("id", sub.metadata.subscription_id) : q2.eq("is_active", true);
    await q2;
  }
  log("linked", { tenantId, sub: sub.id });
}

// Records a paid invoice once. Returns true when it was new.
export async function recordPaidInvoice(db: any, stripe: Stripe, inv: any): Promise<boolean> {
  const subId = invoiceSubscriptionId(inv);
  if (!subId || inv.status !== "paid") return false;
  const sub = await stripe.subscriptions.retrieve(subId);
  const tenantId = sub.metadata?.tenant_id;
  if (!tenantId) return false;
  const { data: exists } = await db.from("tenant_payments").select("id").eq("reference", inv.id).eq("payment_method", "Stripe").maybeSingle();
  if (exists) return false;
  const amount = (inv.amount_paid || 0) / 100;
  const currency = (inv.currency || "gbp").toUpperCase();
  const paidAt = inv.status_transitions?.paid_at ? new Date(inv.status_transitions.paid_at * 1000) : new Date();
  const paymentDate = paidAt.toISOString().split("T")[0];
  const { error } = await db.from("tenant_payments").insert({
    tenant_id: tenantId, subscription_id: sub.metadata?.subscription_id || null, amount, currency,
    payment_date: paymentDate, payment_method: "Stripe",
    stripe_payment_intent_id: typeof inv.payment_intent === "string" ? inv.payment_intent : null,
    reference: inv.id, status: "completed",
  });
  if (error) { if (error.code === "23505") return false; throw error; }
  await db.from("tenants").update({ subscription_status: "active" }).eq("id", tenantId);
  log("payment recorded", { tenantId, amount });

  try {
    const { data: t } = await db.from("tenants").select("name, slug").eq("id", tenantId).single();
    const { data: s } = await db.from("tenant_subscriptions").select("billing_cycle, next_due_date").eq("tenant_id", tenantId).eq("is_active", true).maybeSingle();
    const { data: rows } = await db.from("tenant_memberships").select("user_id, profiles!inner(email)").eq("tenant_id", tenantId).in("role", ["owner", "admin"]);
    const settingsUrl = t?.slug ? `https://app.churchmanagementsuite.org/t/${t.slug}/settings` : "https://app.churchmanagementsuite.org/settings";
    for (const r of rows || []) {
      const email = (r as any).profiles?.email;
      if (!email) continue;
      try {
        await sendLoggedTemplateEmail({
          supabase: db, templateName: "payment-receipt", to: email, tenantId,
          idempotencyKey: `payment-receipt-${inv.id}-${email}`,
          templateData: { churchName: t?.name || "Your Church", amount: amount.toFixed(2), currency, paymentDate,
            paymentMethod: "Stripe", reference: inv.id, billingCycle: s?.billing_cycle || "monthly", nextDueDate: s?.next_due_date || null, settingsUrl },
        });
      } catch (e) { console.error("[stripe-sync] receipt failed", (e as Error).message); }
    }
  } catch (e) { console.error("[stripe-sync] receipt lookup failed", (e as Error).message); }
  return true;
}

export async function markPastDue(db: any, tenantId: string) {
  const { data: t } = await db.from("tenants").select("subscription_status").eq("id", tenantId).single();
  if (t?.subscription_status === "past_due") return; // already told admins
  await db.from("tenants").update({ subscription_status: "past_due" }).eq("id", tenantId);
  const a = await admins(db, tenantId);
  if (a.length) await db.from("notifications").insert(a.map((x: any) => ({
    user_id: x.user_id, title: "Payment Failed", type: "billing", reference_type: "tenant_subscription", tenant_id: tenantId,
    message: "Your subscription payment has failed. Please update your payment method to avoid service interruption.",
  })));
  log("past_due", { tenantId });
}

export async function markCancelled(db: any, sub: Stripe.Subscription) {
  const tenantId = sub.metadata?.tenant_id;
  if (!tenantId) return;
  const { data: row } = await db.from("tenant_subscriptions").select("id").eq("tenant_id", tenantId).eq("stripe_subscription_id", sub.id).maybeSingle();
  if (!row) return; // not linked any more, nothing to undo
  await db.from("tenants").update({ subscription_status: "suspended" }).eq("id", tenantId);
  await db.from("tenant_subscriptions").update({ stripe_subscription_id: null, stripe_price_id: null }).eq("id", row.id);
  const a = await admins(db, tenantId);
  if (a.length) await db.from("notifications").insert(a.map((x: any) => ({
    user_id: x.user_id, title: "Subscription Cancelled", type: "billing", reference_type: "tenant_subscription", tenant_id: tenantId,
    message: "Your subscription has been cancelled. Access will be restricted until a new subscription is activated.",
  })));
  log("cancelled", { tenantId });
}

// Pulls a church's current state from Stripe and applies anything missed.
export async function syncTenantFromStripe(db: any, stripe: Stripe, tenantId: string) {
  const res = await stripe.subscriptions.search({ query: `metadata['tenant_id']:'${tenantId.replace(/[^0-9a-f-]/gi, "")}'`, limit: 10 });
  const { data: row } = await db.from("tenant_subscriptions").select("stripe_subscription_id").eq("tenant_id", tenantId).eq("is_active", true).maybeSingle();
  let recorded = 0;
  const live = res.data.filter((s) => ["active", "trialing", "past_due", "unpaid"].includes(s.status));
  const current = live.sort((a, b) => b.created - a.created)[0];
  if (current && row?.stripe_subscription_id !== current.id) await linkSubscription(db, current);
  for (const s of res.data) {
    const invs = await stripe.invoices.list({ subscription: s.id, status: "paid", limit: 12 });
    for (const inv of invs.data) if (await recordPaidInvoice(db, stripe, inv)) recorded++;
    if (s.status === "canceled") await markCancelled(db, s);
  }
  if (current && ["past_due", "unpaid"].includes(current.status)) await markPastDue(db, tenantId);
  return { linked: current?.id || null, recorded };
}
