# Bank transfer for subscriptions + invoices and receipts for churches

## What churches will see (Settings → Billing)
1. **Pay subscription by bank transfer** — next to the card option. It shows the amount due, a unique reference (e.g. `SUB-XXXXXXXX`) and the same bank details used for SMS top-ups. The church can cancel a pending request.
2. **Invoices & receipts list** — one list covering subscription and SMS top-ups:
   - Each pending bank transfer gets an **invoice** (amount, reference, bank details, due date).
   - Each paid card or bank payment gets a **receipt**.
   - Each line has **Preview** (opens in a pop-up) and **Download PDF** buttons.

## What super admins will see (Tenant Admin → Billing)
- Pending subscription bank transfers, each with a **Mark as received** button. Confirming it records the payment, moves the subscription on to the next billing period and creates the receipt.
- Pending SMS transfers keep working as they do now, but confirming one now also creates a receipt.
- The current invoice editor stays the same. Invoices you write by hand are also shown to the church.

## Rules
- Only church owners and admins can request transfers or see invoices. Churches only ever see their own invoices.
- Only super admins can confirm that money arrived. Nothing is credited or extended until then.
- Amounts and currency come from the church's subscription and billing currency, never from the browser.
- Invoice numbers are sequential and never reused.

## Technical details
- Migration: `request_subscription_bank_payment(tenant_id)`, `confirm_subscription_bank_payment(id, notes)` (super_admin; inserts `tenant_payments`, calls existing `advance_subscription_on_payment` logic) and `cancel_subscription_bank_payment`, all SECURITY DEFINER with role checks. Add `source` ('subscription'|'sms') and `sms_topup_id` to `tenant_invoices`, and auto-create invoice/receipt rows from the request, confirm and Stripe webhook paths (SMS + subscription). Add a SELECT policy so tenant owners/admins can read their own rows; insert/edit stays super-admin only.
- Update the `confirm_sms_bank_topup` and `stripe-subscription-webhook` SMS/subscription paths to create receipts.
- UI: new `src/components/billing/ChurchInvoicesCard.jsx` in Settings Billing that reuses `InvoicePreview.jsx` (already supports PDF capture) for preview and download; subscription bank-transfer button in the church subscription card; a pending-transfers list in `TenantBillingTab.jsx`.
- Tests: amount comes from the subscription; only super admins can confirm; a church cannot read another church's invoices (checked with SQL).
