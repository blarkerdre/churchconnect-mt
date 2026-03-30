

## Automated Tenant Payment System with Stripe Integration

### Overview
Add a subscription billing system using Stripe where tenants pay monthly or yearly. Super Admins configure pricing per tenant. Tenants whose payment lapses get denied access with a "Payment Required" screen. Tenant owners/admins can pay directly via Stripe checkout.

### Database changes (1 migration)

**New table: `tenant_subscriptions`**
- `id` UUID PK, `tenant_id` UUID FK UNIQUE → tenants
- `billing_cycle` text ('monthly' | 'yearly') default 'monthly'
- `amount` numeric NOT NULL, `currency` text default 'GBP'
- `next_due_date` date NOT NULL
- `grace_period_days` integer default 7
- `stripe_customer_id` text, `stripe_subscription_id` text
- `is_active` boolean default true
- `created_at`, `updated_at` timestamps
- Tenant-scoped RLS

**New table: `tenant_payments`**
- `id` UUID PK, `tenant_id` UUID FK, `subscription_id` UUID FK
- `amount` numeric, `currency` text, `payment_date` date
- `payment_method` text, `stripe_payment_intent_id` text
- `reference` text, `notes` text, `recorded_by` UUID, `status` text default 'completed'
- `created_at` timestamp, tenant-scoped RLS

**Add to `tenants`:**
- `subscription_status` text default 'active' ('active' | 'past_due' | 'suspended')

**DB trigger:** `advance_subscription_on_payment` — AFTER INSERT on `tenant_payments` where status='completed', advances `next_due_date` and sets tenant status to 'active'

### Stripe integration

**Enable Stripe** via the Stripe tool, then:

1. **Edge function: `create-tenant-checkout`** — creates a Stripe Checkout session for the tenant's subscription amount. Called by tenant owners/admins from billing UI. Stores `stripe_customer_id` on the subscription record.

2. **Edge function: `stripe-subscription-webhook`** — handles `checkout.session.completed` and `invoice.paid` events. Records payment in `tenant_payments`, advances subscription.

3. **Edge function: `check-tenant-payments`** (cron, daily) — marks overdue tenants as `past_due` or `suspended` based on grace period. Sends in-app notification.

### Frontend changes

#### Access gate — `TenantContext.jsx`
- Expose `subscription_status` from the tenant object
- If `suspended` → render `PaymentRequiredScreen` blocking all access
- If `past_due` → show `PaymentWarningBanner` (dismissible)
- Super Admins bypass both gates

#### New components
- **`PaymentRequiredScreen.jsx`** — full-screen card showing amount due, due date, and "Pay Now" button that triggers Stripe checkout
- **`PaymentWarningBanner.jsx`** — amber dismissible banner for `past_due` state

#### Tenant Admin — Billing tab (Super Admin)
- Configure subscription per tenant: cycle, amount, currency, next due date, grace period
- View payment history with date filters
- Manual status override (active/past_due/suspended)
- View Stripe customer/subscription IDs

#### Settings page — Billing section (Tenant owner/admin)
- View subscription status, next due date, amount
- Payment history
- "Pay Now" button → Stripe checkout
- Success page after payment confirmation

### Security
- Subscription/payment tables have tenant-scoped RLS
- Stripe webhook validates signature
- Payment initiation restricted to tenant owners/admins
- Status override restricted to Super Admins
- Cron function uses service-role key
- Super Admins always bypass payment gate

### Files changed
1. **New migration** — 2 tables, 1 column on tenants, 1 trigger
2. **New edge function** — `create-tenant-checkout`
3. **New edge function** — `stripe-subscription-webhook`
4. **New edge function** — `check-tenant-payments`
5. **New component** — `PaymentRequiredScreen.jsx`
6. **New component** — `PaymentWarningBanner.jsx`
7. **Edit** — `TenantContext.jsx` — expose subscription_status, gate logic
8. **Edit** — `AppLayout.jsx` — render warning banner
9. **Edit** — `TenantAdmin.jsx` — billing tab
10. **Edit** — `Settings.jsx` — billing section with Pay Now

