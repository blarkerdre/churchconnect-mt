

## Issue
The tenant-facing Billing & Subscription card in **Settings** does not display the configured one-time **Setup Fee**, even though the Super Admin has set it. Tenant owners cannot see what they will be charged on first checkout.

## Root cause
`src/pages/Settings.jsx` (lines ~209-217) renders only Status, Amount, Billing Cycle and Next Due Date from the `subscription` object. The `setup_fee_amount` / `setup_fee_paid` fields are already fetched (via `select("*")`) but never displayed.

## Fix (single file)

**`src/pages/Settings.jsx`** — inside the subscription summary block (after Next Due Date, before the Stripe-auto-renewing badge), add:

1. A **Setup Fee** row, shown only when `Number(subscription.setup_fee_amount) > 0`:
   - Label: "Setup Fee (one-time)"
   - Value: `{currency} {amount}` + a small badge — "Paid" (green) if `setup_fee_paid`, otherwise "Due with first payment" (amber).

2. When the tenant has not yet subscribed via Stripe AND a setup fee is unpaid, add a small helper line under the Subscribe button:
   > "Your first payment will include a one-time setup fee of `{currency} {setup_fee_amount}` plus the recurring `{currency} {amount}` / {cycle}."

No backend changes needed — the `create-tenant-checkout` edge function already adds the setup fee as a second Stripe line item when `setup_fee_amount > 0 && !setup_fee_paid`.

## Out of scope
- No DB migration, no edge function changes.
- No changes to the Super Admin Tenant Billing tab (already shows the setup fee correctly).

## Mobile (384 px)
Rows use the existing `flex justify-between` layout which already wraps cleanly; the badge is rendered inline next to the amount.

