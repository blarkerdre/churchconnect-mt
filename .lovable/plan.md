

## Goal
Add the ability for Super Admins to **generate, edit, preview, download, and email** invoices and receipts to tenants from the Tenant Billing tab.

## Context I confirmed
- `tenant_payments` (existing) tracks completed payments — receipts derive from these.
- `tenant_subscriptions` (existing) drives recurring amounts — invoices derive from upcoming dues.
- `payment-receipt.tsx` React Email template already exists and is wired into the registry — usable for receipt emails.
- `send-transactional-email` edge function already supports arbitrary `templateData` and tenant scoping.
- `jspdf` + `html2canvas` are already installed → no new deps for PDF generation.
- No existing "invoice" template, no `tenant_invoices` table, no invoice numbering.

## Design

### 1. New table: `tenant_invoices`
Stores generated invoices/receipts so they have permanent numbers, can be re-downloaded, re-sent, and edited before send.

| Column | Purpose |
|---|---|
| `id` | uuid PK |
| `tenant_id` | FK → tenants |
| `subscription_id` | FK → tenant_subscriptions (nullable) |
| `payment_id` | FK → tenant_payments (nullable, set when document_type='receipt') |
| `document_type` | text: `invoice` or `receipt` |
| `invoice_number` | text unique per tenant, format `INV-2026-0001` / `RCT-2026-0001` |
| `status` | text: `draft`, `sent`, `paid`, `void` |
| `issue_date`, `due_date` | dates |
| `currency`, `subtotal`, `tax_amount`, `total` | numerics |
| `line_items` | jsonb array `[{description, quantity, unit_price, amount}]` |
| `bill_to` | jsonb `{name, email, address, contact_name}` |
| `notes`, `terms` | text (editable) |
| `pdf_url` | text (storage path, optional cache) |
| `sent_at`, `sent_to` | timestamp + email captured at send |
| `created_by`, `created_at`, `updated_at` | audit |

RLS: Super admins full access; tenant admins SELECT only their own.

### 2. New invoice email template
`supabase/functions/_shared/transactional-email-templates/tenant-invoice.tsx`
Mirrors `payment-receipt.tsx` styling; renders line items, totals, due date, "Pay Now" button (uses Stripe checkout link if subscription has one, else manage URL). Register in `registry.ts`.

### 3. New edge function: `generate-tenant-invoice`
- Input: `{ tenant_id, document_type, payment_id?, subscription_id?, line_items?, due_date?, notes? }`
- Logic:
  - If `document_type='receipt'` and `payment_id` provided → prefill from payment + subscription.
  - If `document_type='invoice'` → prefill from subscription (next due date, amount, setup fee if unpaid).
  - Generate next sequential `invoice_number` per tenant + year.
  - Insert row in `tenant_invoices` with status `draft`.
  - Returns the invoice row.

### 4. New edge function: `send-tenant-invoice`
- Input: `{ invoice_id, recipient_email?, override_subject? }`
- Loads invoice + tenant. Calls `send-transactional-email` with template `tenant-invoice` (or `payment-receipt` for receipts) and full template data.
- Updates row to `status='sent'`, `sent_at`, `sent_to`.

### 5. UI: extend `TenantBillingTab.jsx`
Add a third section **"Invoices & Receipts"** below Payment History:

```text
Invoices & Receipts                       [+ New Invoice] [+ New Receipt]
─────────────────────────────────────────────────────────────────────────
INV-2026-0007   Invoice  £55.00   Due 2026-05-05    Sent    [Edit][PDF][Send]
RCT-2026-0011   Receipt  £50.00   2026-04-05        Sent    [View][PDF][Resend]
```

- **+ New Receipt** button on each completed Payment row (inline action) → calls `generate-tenant-invoice` with `document_type='receipt'`, opens edit dialog.
- **+ New Invoice** button → opens blank dialog prefilled from active subscription.
- **Edit dialog** (`InvoiceEditorDialog.jsx`): editable fields for bill-to, line items (add/remove rows, qty × unit price auto-totals), notes/terms, due date. Live preview pane on the right (desktop) or below (mobile) rendered with the same styling as the email template.
- **Download PDF**: client-side render using existing `jspdf` + `html2canvas` against the preview pane → `Invoice-INV-2026-0007.pdf`.
- **Send**: confirms recipient email (defaults to tenant owner's email), calls `send-tenant-invoice`.

### 6. Tenant-side visibility (small)
On the existing Settings → Billing area for tenant admins, add a read-only "Invoices & Receipts" list with Download PDF buttons. Reuses the same components.

## Files

**New (DB)**
- Migration: create `tenant_invoices` table + RLS + sequence helper function `next_invoice_number(tenant_id, doc_type)`

**New (Edge Functions)**
- `supabase/functions/generate-tenant-invoice/index.ts`
- `supabase/functions/send-tenant-invoice/index.ts`
- `supabase/functions/_shared/transactional-email-templates/tenant-invoice.tsx`

**New (UI)**
- `src/components/tenants/InvoicesReceiptsList.jsx`
- `src/components/tenants/InvoiceEditorDialog.jsx`
- `src/components/tenants/InvoicePreview.jsx` (shared HTML used for both on-screen preview and PDF capture)

**Edit**
- `supabase/functions/_shared/transactional-email-templates/registry.ts` (register `tenant-invoice`)
- `src/components/tenants/TenantBillingTab.jsx` (mount `InvoicesReceiptsList`, add inline "Receipt" action on each payment row)
- (Optional) `src/pages/Settings.jsx` — add tenant-admin read-only view

## Out of scope
- VAT / tax engine (single optional tax line input only)
- Multi-currency conversion (uses subscription's currency)
- Stripe-hosted invoices (these are app-generated; Stripe webhooks remain unchanged)
- Refund / credit notes

## Mobile considerations (384 px)
Editor dialog uses single-column stacked layout with collapsible preview; line-item rows render as compact cards instead of a table.

