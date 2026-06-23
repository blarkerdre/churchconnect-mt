
## Goal

Give Super Admins a complete pricing & costing system for the Church Management Suite: define **plan tiers with included quotas**, **bill overages** automatically, drive billing through **Stripe or manual invoices**, and back it all with a **cost-plus calculator** so each tier stays profitable.

The current project already has `tenant_subscriptions`, `tenant_invoices`, `tenant_payments`, a `stripe-subscription-webhook` Edge Function, and live quota fields on `tenants` (`member_limit`, `storage_limit_mb`, `sms_limit_monthly`, `whatsapp_limit_monthly`). We extend rather than replace.

## 1. Plan catalog (Super Admin → Pricing)

New page `/tenant-admin/pricing` (Super Admin only) with three tabs:

### Tab A — Plans
CRUD for plan tiers. Each plan stores:
- Name, slug, description, sort order, is_active, is_public
- Base price (monthly + annual), currency, optional setup fee
- Stripe product/price IDs (monthly + annual)
- **Included quotas**: members, storage MB, SMS, WhatsApp, email, AI calls, edge function invocations
- **Overage unit prices** per metric (e.g. £0.04 / extra SMS, £0.50 / extra GB)
- Feature flags (which modules are enabled — Bible School, Children Church, Transportation, Exams, Domifort, etc.)

### Tab B — Cost calculator
Super Admin inputs current **unit costs** (e.g. Twilio £0.032/SMS, Resend £0.0004/email, Supabase £0.021/GB-month, Lovable AI £x/1k tokens) and a **target margin %**. The page then computes, for each plan:
- Expected monthly cost per tenant at full quota
- Recommended sell price (cost × (1 + margin))
- Variance vs. current price, with a "Apply suggested price" button
- Per-overage suggested unit price using the same margin
Saved costs live in a new `pricing_cost_inputs` table.

### Tab C — Live usage & margin
Per-tenant table pulling from existing `sms_log`, `email_send_log`, storage usage RPC, members count, AI call log. Columns: tenant, plan, included vs used per metric, projected overage £, projected gross margin. Helps spot tenants on the wrong tier.

## 2. Database (migration)

New tables (all `tenant_admin`/super-admin scoped, with GRANTs + RLS):

- `pricing_plans` — catalog described above
- `pricing_cost_inputs` — `{ metric, unit_cost, currency, effective_from, notes }`
- `tenant_usage_counters` — monthly rollup `{ tenant_id, period_start, metric, used, included, overage_units, overage_amount }`
- `tenant_overage_charges` — line items pending invoice `{ tenant_id, period, metric, qty, unit_price, amount, status }`

Extend existing tables:
- `tenants.pricing_plan_id` (FK), keep legacy `plan_tier` text as derived
- `tenant_subscriptions.pricing_plan_id`, `billing_interval` (`monthly`|`annual`), `payment_mode` (`stripe`|`manual`)

A nightly Edge Function `aggregate-tenant-usage` writes counters from the source logs and flags overages.

## 3. Billing engine

Both rails supported per tenant (chosen at onboarding or in Tenant Billing tab):

**Stripe rail (self-serve)**
- Reuse `manage-tenant-subscription` to create subscription on selected plan's Stripe price.
- New `report-stripe-overage` runs at period close: pushes `tenant_overage_charges` as Stripe **invoice items** before the next invoice finalizes, so overage is billed automatically.
- Existing `stripe-subscription-webhook` updates `subscription_status` and records payments.

**Manual rail**
- `generate-tenant-invoice` extended to pull plan base + setup fee + open overage charges into `line_items` and produce the PDF.
- `send-tenant-invoice` already emails it. Super Admin records bank-transfer payments in `tenant_payments`; status flows back to `tenant_invoices`.

`check-tenant-payments` keeps gating access via `PaymentRequiredScreen` for past-due tenants on either rail.

## 4. Quota enforcement (already partly there)

- Member limit trigger and storage RPC already exist — point them at `pricing_plans.included_members` / `included_storage_mb` via the tenant's plan instead of the per-tenant columns.
- SMS / WhatsApp / email send paths: when included quota is exhausted, either (a) hard-stop if plan disallows overage, or (b) log to `tenant_overage_charges` and continue. Plan has a `allow_overages` boolean per metric.

## 5. Tenant-facing surface

Inside each tenant's **Settings → Billing** tab (existing `TenantBillingTab`):
- Current plan card with included vs used bars for every metric
- Upgrade/downgrade button (Stripe Checkout or "request change" for manual tenants)
- Invoice + payment history (already present)
- Projected next bill including overages

No public `/pricing` marketing page in this iteration (per your choice).

## Out of scope
- Public pricing page / landing site changes
- Multi-currency conversion (single currency per tenant for now)
- Coupons / promo codes (can be added later via Stripe coupons)

## Technical notes

```text
Super Admin /tenant-admin/pricing
  ├─ Plans tab        → pricing_plans (CRUD, sync Stripe products/prices)
  ├─ Costs tab        → pricing_cost_inputs + live calculator
  └─ Usage tab        → tenant_usage_counters joined to pricing_plans

Nightly cron (pg_cron → aggregate-tenant-usage)
  └─ writes tenant_usage_counters + tenant_overage_charges

Period close
  ├─ Stripe tenants  → report-stripe-overage (Stripe invoice items)
  └─ Manual tenants  → generate-tenant-invoice picks up open charges

Existing: stripe-subscription-webhook, check-tenant-payments, PaymentRequiredScreen
```

Stripe products and prices for each plan will be created via the Stripe MCP tool once you approve the plan list (one product per tier, two prices per product: monthly + annual; plus one metered "overage" price per metric you want to bill through Stripe).
