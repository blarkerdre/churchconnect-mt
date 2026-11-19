# SMS cost per church, top-ups and extra-text charging

## What you'll get
1. **Price per text for each church (Tenant Admin -> church -> Plan & Billing)**
   - New "Cost per SMS" box. Leave blank to use the plan's normal price; fill in to give that church its own price.
   - Also shows the church's monthly free texts, texts used this month, and top-up balance.
2. **Top-up texts (church Settings -> Billing & Subscription)**
   - Owners/admins see "Texts this month: X of Y" and their top-up balance.
   - "Buy more texts" lets them choose a pack (100, 500, 1,000, 5,000 or a custom amount). The price is shown using their church's cost per text, and they pay by card through Stripe.
   - Once payment goes through, the texts are added to their balance straight away. Each purchase shows in their billing history.
3. **What happens when the free monthly texts run out**
   - Texts first come out of the top-up balance.
   - When the balance is empty: if the plan allows extra texts, sending continues and the extras are added to the next monthly invoice at the church's cost per text. If it doesn't, sending stops with a message: "Your monthly texts are used up. Buy more texts in Billing."
   - Top-up texts carry over to the next month. Free monthly texts don't.
4. **Super admin view**: a list of each church's top-up purchases and extra-text charges.

## Technical details
- Migration: `tenants.sms_unit_price_override numeric null`, `tenants.sms_credit_balance int default 0`; new `sms_topups` table (tenant_id, quantity, unit_price, amount, currency, stripe_session_id, status, created_at) with RLS (tenant admins read own, super admin all, writes service_role only) and grants. RPC `consume_sms_credits(tenant, n)` is atomic and returns any shortfall.
- `_shared/sms-quota.ts`: monthly quota -> credit balance -> overage (if `allow_overage_sms`) -> block.
- `aggregate-tenant-usage`: price uses override ?? plan `overage_price_sms`, and subtracts units already paid by credits.
- New edge function `create-sms-topup-checkout`: checks admin + tenant, computes the price on the server, creates a one-off Stripe Checkout payment with metadata. `stripe-subscription-webhook` handles `checkout.session.completed` for type `sms_topup` (idempotent on session id) and adds the credits.
- UI: PricingTab/TenantBillingTab override field; Settings BillingSection usage + top-up dialog.
- Tests: price resolution (override vs plan), quota order (quota -> credits -> overage/block).
