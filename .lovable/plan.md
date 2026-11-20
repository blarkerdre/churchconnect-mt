# Add an "SMS Usage" report to the Reports Hub

## What you'll see
A new **SMS Usage** card in the Reports Hub. Opening it shows, for the church:
- **Monthly allowance**: texts used this month / free monthly quota (same numbers as Settings, e.g. 74/100), plus WhatsApp used / quota.
- **Top-up balance**: texts left from bought packs, and the cost per text and currency.
- **Texts available now** (free left + top-up balance).
- **Sent summary** for a chosen period (this month, last month, last 3 months, custom): sent, delivered, failed, WhatsApp, how many came from free vs top-up.
- **Month-by-month table** for the last 6 months, plus a **Download CSV** button.
- **Recent top-ups** (card or bank transfer, amount, status).

Read-only; available to admins and the Reports Officer role, the same people who see the rest of the Reports Hub.

## Technical details
- `src/pages/Reports.jsx`: add card linking to `/reports/sms`.
- New page `src/pages/SmsUsageReport.jsx` + route in the tenant router (guarded like `/reports`).
- Reuse existing data: tenant plan quotas + `sms_credit_balance` / price override (same source as SmsTopUpCard), `sms_log` counts with `status != 'failed'` and `.eq("tenant_id", tenantId)`, `sms_credit_ledger` for free vs top-up split, `sms_topups` list. Reuse `MessageSummaryPanel` logic for period stats.
- CSV via `csvSafeCell`. No database changes.
