# One billing currency per church (subscription + SMS)

## What changes
- **Tenant Admin -> church -> Billing:** a new **Billing currency** picker (GBP, USD, EUR, NGN, CAD) at the top. It applies to the church's subscription, its Cost per SMS, SMS top-ups and extra-text charges on invoices.
- The existing subscription currency picker is replaced by this single setting, so subscription and SMS can't drift apart.
- **Cost per SMS** label shows the chosen currency. If a church has no own SMS price, the plan's price is used only when the plan's currency matches; otherwise the buy option is hidden with a note "Set a Cost per SMS in <currency>".
- **Church Settings -> Billing & Subscription:** amounts, top-up packs and receipts show in the church's currency.
- Changing currency affects future payments only; past payments and invoices keep their original currency. Changing it while a Stripe subscription is active shows a warning that the subscription must be recreated (Stripe can't change currency on a live subscription).

## Technical details
- Migration: add `tenants.billing_currency text default 'GBP'` with check on allowed codes; backfill from `tenant_subscriptions.currency`, else plan currency.
- On save, also update `tenant_subscriptions.currency`.
- `create-sms-topup-checkout`, `aggregate-tenant-usage`, `report-stripe-overage`, `create-tenant-checkout`: resolve currency from `tenants.billing_currency`; reject plan-price fallback on currency mismatch.
- `SmsTopUpCard`, `SmsPricingAdmin`, `TenantBillingTab`, `Settings.jsx`: read and format with the tenant currency.
- Unit test for currency resolution and mismatch rule; redeploy changed functions.
