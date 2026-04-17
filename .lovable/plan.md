
The user wants to include one-time setup fees in the tenant subscription/billing flow. I need to understand the current billing setup before planning.

Let me check the relevant files: `TenantBillingTab.jsx`, `create-tenant-checkout/index.ts`, the tenant_subscriptions schema, and the Plan tab in TenantAdmin.

Key questions I need answered before planning:
1. Is the setup fee per-tenant configurable, or fixed by plan tier?
2. Should it be charged once on first checkout, or as a separate invoice?
3. Should super admins set the amount, or should it be tied to the plan tier (free/starter/pro)?

Rather than ask 3 questions, I'll make sensible defaults and flag them in the plan so the user can correct.

## Plan

### Approach
Add an optional **one-time setup fee** that's billed alongside the first subscription payment via Stripe Checkout (single session, two line items: recurring + one-time).

### Where it lives
1. **`tenant_subscriptions` table** — add columns:
   - `setup_fee_amount` (numeric, default 0)
   - `setup_fee_paid` (boolean, default false)
   - `setup_fee_paid_at` (timestamptz)

2. **Tenant Admin → Plan tab** (`src/pages/TenantAdmin.jsx`) — Super admin can set the setup fee amount per tenant when configuring the plan. Shows whether it's been paid.

3. **`create-tenant-checkout` edge function** — if `setup_fee_amount > 0` and `setup_fee_paid = false`, add a second `line_items` entry as a one-time charge alongside the recurring subscription line.

4. **`stripe-subscription-webhook`** — on `checkout.session.completed` or `invoice.paid` for the first invoice, mark `setup_fee_paid = true` so it's not charged again on renewal.

5. **`TenantBillingTab.jsx`** — display the setup fee line and its paid status to tenant owners.

### Files Changed
- New migration: add 3 columns to `tenant_subscriptions`
- `supabase/functions/create-tenant-checkout/index.ts` — add setup fee line item conditionally (~15 lines)
- `supabase/functions/stripe-subscription-webhook/index.ts` — flag `setup_fee_paid` on first payment (~10 lines)
- `src/pages/TenantAdmin.jsx` — setup fee input on Plan tab (~20 lines)
- `src/components/tenants/TenantBillingTab.jsx` — show setup fee row (~15 lines)

### Defaults / assumptions (correct me if wrong)
- Setup fee is **per-tenant**, set by super admin (not tied to plan tier preset).
- Charged **once with the first subscription payment** in the same Stripe Checkout session.
- Currency matches the existing subscription currency.
- If you'd rather have setup fee presets per plan tier (free/starter/pro), or bill it as a standalone invoice before subscription starts, say so and I'll adjust.
