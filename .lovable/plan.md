

## Convert Billing to Recurring Stripe Subscriptions

### Problem
Currently, the checkout flow uses `mode: "payment"` (one-time charges). Tenants must manually pay each cycle. The `advance_subscription_on_payment` trigger advances the `next_due_date`, but Stripe doesn't automatically charge again — someone must click "Pay Now" every month/year.

### Solution
Switch to Stripe's native recurring subscription model (`mode: "subscription"`) so Stripe automatically charges tenants each billing cycle. The webhook handles invoice events to record payments and update statuses automatically.

### Changes

#### 1. `supabase/functions/create-tenant-checkout/index.ts` — Switch to subscription mode
- Change `mode: "payment"` to `mode: "subscription"`
- Use `price_data` with `recurring: { interval: sub.billing_cycle === "yearly" ? "year" : "month" }` so Stripe creates a recurring price
- Remove `metadata` from the session level (subscription metadata is set separately)
- Add `subscription_data.metadata` with `tenant_id` and `subscription_id` so the webhook can identify the tenant from recurring invoice events

#### 2. `supabase/functions/stripe-subscription-webhook/index.ts` — Handle subscription lifecycle events
Expand from handling only `checkout.session.completed` to also handle:
- **`invoice.payment_succeeded`** — Record payment in `tenant_payments`, update tenant status to `active`, store `stripe_subscription_id` on first payment, advance `next_due_date`
- **`invoice.payment_failed`** — Set tenant status to `past_due`
- **`customer.subscription.deleted`** — Set tenant status to `suspended`
- **`checkout.session.completed`** — Store `stripe_subscription_id` and `stripe_customer_id` on the `tenant_subscriptions` row

The `invoice.payment_succeeded` handler retrieves `tenant_id` from the subscription's metadata (via `stripe.subscriptions.retrieve`).

#### 3. `supabase/functions/check-tenant-payments/index.ts` — Sync with Stripe status
For tenants that have a `stripe_subscription_id`, optionally query Stripe to confirm the subscription status rather than relying solely on date math. Keep the existing date-based logic as fallback for manually-billed tenants (no `stripe_subscription_id`).

#### 4. `src/components/tenants/TenantBillingTab.jsx` — Show Stripe subscription status
- Display the `stripe_subscription_id` if present (like the existing `stripe_customer_id` display)
- Add a "Cancel Subscription" button that calls a new edge function or uses the Stripe customer portal
- Show "Auto-renewing" badge when a Stripe subscription is active

#### 5. New: `supabase/functions/manage-tenant-subscription/index.ts` — Cancel/manage subscription
- Accepts `action: "cancel" | "portal"` and `tenant_id`
- For `cancel`: calls `stripe.subscriptions.cancel(stripe_subscription_id)`
- For `portal`: creates a Stripe Customer Portal session so the tenant admin can manage payment methods, view invoices, or cancel
- Returns the portal URL or confirmation

#### 6. `src/pages/Settings.jsx` — Add "Manage Subscription" button
- For tenants with an active Stripe subscription, show "Manage Subscription" (opens Stripe Customer Portal) instead of / alongside the "Pay Now" button
- Keep "Pay Now" for tenants without a Stripe subscription (manual billing)

#### 7. Database migration — Add `stripe_price_id` column
Add `stripe_price_id text` to `tenant_subscriptions` to store the recurring Stripe price ID after checkout. This allows re-using the same price for subscription updates.

### How it works end-to-end

```text
Tenant Admin clicks "Subscribe"
  → create-tenant-checkout (mode: "subscription")
  → Stripe Checkout page
  → Stripe creates subscription + first invoice
  → Webhook: checkout.session.completed → store stripe_subscription_id
  → Webhook: invoice.payment_succeeded → record payment, set status active
  
Next billing cycle (automatic):
  → Stripe charges card automatically
  → Webhook: invoice.payment_succeeded → record payment, advance next_due_date
  
If payment fails:
  → Webhook: invoice.payment_failed → set status past_due
  → Stripe retries per its retry settings
  
If subscription canceled:
  → Webhook: customer.subscription.deleted → set status suspended
```

### Files changed
- `supabase/functions/create-tenant-checkout/index.ts` — switch to `mode: "subscription"`
- `supabase/functions/stripe-subscription-webhook/index.ts` — handle invoice and subscription lifecycle events
- `supabase/functions/check-tenant-payments/index.ts` — respect Stripe-managed subscriptions
- `src/components/tenants/TenantBillingTab.jsx` — show subscription ID, add cancel/manage button
- `src/pages/Settings.jsx` — add "Manage Subscription" portal button
- New: `supabase/functions/manage-tenant-subscription/index.ts` — cancel subscription or open portal
- Database migration — add `stripe_price_id` column to `tenant_subscriptions`

