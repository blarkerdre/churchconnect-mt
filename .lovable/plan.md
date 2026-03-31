

## Fix: Signup Emails Still Showing "pending" — `tenant_id` Missing on Terminal Log Rows

### Root cause
The `process-email-queue` edge function writes terminal status rows (`sent`, `failed`, `rate_limited`, `dlq`) to `email_send_log` **without `tenant_id`**, even though the payload contains it. The tenant-scoped dashboard query only sees the earlier `pending` row (which has `tenant_id`), so the email appears stuck as "pending."

The auth-email-hook correctly enqueues `tenant_id` in the payload (line 305), but `process-email-queue` never reads `payload.tenant_id` when inserting log rows.

### Fix
Update `supabase/functions/process-email-queue/index.ts` to include `tenant_id: payload.tenant_id` in every `email_send_log` insert:

1. **`moveToDlq` function** (line 63-69) — add `...(payload.tenant_id ? { tenant_id: payload.tenant_id } : {})`
2. **Sent log** (line 271-276) — add `...(payload.tenant_id ? { tenant_id: payload.tenant_id } : {})`
3. **Rate-limited log** (line 298-304) — add `...(payload.tenant_id ? { tenant_id: payload.tenant_id } : {})`
4. **Failed log** (line 335-341) — add `...(payload.tenant_id ? { tenant_id: payload.tenant_id } : {})`

Then redeploy `process-email-queue`.

### Backfill
Run a migration to copy `tenant_id` from existing `pending` rows to their matching terminal rows (same `message_id`) that currently have `NULL` tenant_id.

### Files changed
- `supabase/functions/process-email-queue/index.ts` — add `tenant_id` to all 4 log insert sites
- 1 new migration — backfill existing terminal rows
- Deploy `process-email-queue`

