Add issuer/company details (DomiFort Solutions Limited) to the invoice & receipt — both the on-screen/PDF preview and the emailed version — so every invoice clearly shows who is billing the church.

## What will appear on every invoice/receipt

A new "From" block, shown above the existing "Bill To" block, with:

- **DomiFort Solutions Limited**
- Flat 9, 2 Oriana Court, Crunden Road, South Croydon, United Kingdom, CR2 6GZ
- Company Reg: 17169095
- Email: info@domifortsolutions.com
- Web: www.domifortsolutions.com

A new "Payment Details" block, shown below the totals (only on **invoices**, not receipts — receipts are already paid):

- Bank: (issuer payment instructions)
- Sort Code: **04-06-05**  *(entered as "O40605" — treated as 04-06-05; please confirm)*
- Account Number: **31369676**
- Account Name: DomiFort Solutions Limited
- Reference: the invoice number

Footer line will be updated from "issued by churchconnect-mt" to "Issued by DomiFort Solutions Limited · Company No. 17169095".

## Files to change

1. `src/components/tenants/InvoicePreview.jsx` — add From block (top), Payment Details block (invoices only), updated footer. This drives both the on-screen preview and the html2canvas PDF export.
2. `supabase/functions/_shared/transactional-email-templates/tenant-invoice.tsx` — mirror the same From / Payment Details / footer additions so emailed invoices match. Replace `SITE_NAME = "churchconnect-mt"` with the DomiFort issuer block.

Constants for the issuer details will be defined once at the top of each file (no DB changes, no new settings UI) so they stay in sync and are easy to update later.

## Open question

The sort code you provided reads **O40605** (with a letter O). UK sort codes are 6 digits, so I'll render it as **04-06-05**. Confirm this is correct, or send the intended digits.

## Out of scope

- No database migration, no editable issuer settings UI, no logo upload — just the static issuer details on the document. Can be promoted to settings later if multiple issuers are ever needed.
