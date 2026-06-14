## Goal

Make sure the System Logs "pending email" issue is resolved for **every tenant**, not just Mayodare's recovery email.

## Root cause (recap)

`process-email-queue` writes the terminal status row (`sent` / `failed` / `dlq` / `rate_limited`) without `tenant_id`. The System Logs query is tenant-scoped, so only the original `pending` row is visible and dedup never sees the finalised row — so historic emails for **all tenants** look stuck on "pending".

## Plan

1. **Forward fix (already in place, applies to every tenant)**
   - `supabase/functions/process-email-queue/index.ts` — propagate `payload.tenant_id` onto all four `email_send_log` insert sites (`sent`, `failed`, `dlq`, `rate_limited`).
   - From now on, every new email for every tenant will have matching tenant_id on both rows, so dedup works.

2. **Backfill migration (already drafted, runs across all tenants)**
   - `supabase/migrations/...backfill_email_log_tenant.sql`
   - Single global UPDATE: for every terminal row where `tenant_id IS NULL`, copy `tenant_id` from any sibling row with the same `message_id` that does have one.
   - No tenant filter — touches every historic row across every tenant in one pass.

3. **Verification**
   - After the migration runs, query `email_send_log` grouped by status to confirm the pending-row counts drop and `sent` counts rise across multiple tenants.
   - Spot-check System Logs in a couple of tenants (Mayodare's recovery + one other) to confirm "pending" entries now show their true terminal status.

## Out of scope

- No UI/code changes to `SystemLogs.jsx` — its dedup logic is already correct once the data is right.
- No changes to RLS policies on `email_send_log`.
- No tenant-by-tenant manual cleanup needed.
