
Root cause is now narrower than just “email still pending”:

1. The latest `email-alert` send is actually succeeding end-to-end
   - recent log flow for one alert is `pending -> sent`
   - so the invalid `from` issue is no longer the active blocker for new sends

2. What still looks broken is the monitoring/scoping model
   - `send-email-alert` writes the initial `pending` row with `tenant_id`
   - `process-email-queue` writes the terminal `sent` / `failed` / `dlq` rows without `tenant_id`
   - your Email Logs page applies tenant scoping with `.eq("tenant_id", tenantId)`
   - result: tenant users can see the scoped `pending` row, but the matching `sent` row is filtered out because its `tenant_id` is `NULL`
   - that makes successful emails appear “stuck pending”

Evidence from the current project:
- latest alert message shows:
  - `pending` with tenant_id set
  - `sent` with tenant_id = NULL
- most recent email-alert row already reached `sent`
- a large share of recent `email_send_log` rows have `tenant_id = NULL`, so this affects more than just alerts

Plan to fix:

### 1) Preserve tenant context in queued payloads
Update `supabase/functions/send-email-alert/index.ts` so the queued payload includes `tenant_id`.

Also audit the other custom queue producers that insert `pending` rows directly and enqueue custom payloads:
- `notify-unit-leader/index.ts`
- `notify-transport-booking/index.ts`
- `notify-followup-assignment/index.ts`
- `notify-pastoral-assignment/index.ts`
- `notify-wsf-leader/index.ts`
- `issue-certificate/index.ts` if it logs email states the same way

Goal: every queued message that originates from a tenant-scoped action should carry `tenant_id` inside the payload.

### 2) Make queue processor write terminal rows with the same tenant_id
Edit `supabase/functions/process-email-queue/index.ts` so every insert into `email_send_log` includes:
- `...(payload.tenant_id ? { tenant_id: payload.tenant_id } : {})`

Apply this consistently for:
- `sent`
- `failed`
- `rate_limited`
- `dlq` via `moveToDlq()`

This is the core fix, because it keeps all status transitions visible inside the same tenant scope.

### 3) Keep auth/global emails unchanged unless tenant can be resolved
For auth emails and any true global/system emails:
- keep existing behavior where tenant_id may be omitted if unknown
- only attach tenant_id when it is already known/resolved

That avoids over-scoping global messages while still fixing tenant-local app emails.

### 4) Clean up misleading old rows
Add one migration to mark stale tenant-scoped `pending` rows as failed only where a newer terminal row exists for the same `message_id` but tenant scoping hid it previously.

Safer cleanup rule:
- only target rows where:
  - status = `pending`
  - same `message_id` has a newer `sent` / `failed` / `dlq`
  - older row still remains pending
- do not blanket-fail all pending rows

This avoids damaging legitimately queued emails.

### 5) Verify the Email Logs page behavior after backend fix
No major UI rewrite should be needed if terminal rows get correct tenant_id.
But I would also review `src/pages/EmailDashboard.jsx` to confirm:
- deduplication still picks the latest row per `message_id`
- tenant-scoped users now correctly see `sent` instead of `pending`
- counts/stats update correctly

### Expected outcome
After this fix:
- newly sent tenant emails will show `pending -> sent` within the same tenant scope
- tenant admins will stop seeing successful emails as permanently pending
- old misleading rows will be cleaned up without affecting valid in-flight queue items

### Files to update
- `supabase/functions/process-email-queue/index.ts`
- `supabase/functions/send-email-alert/index.ts`
- likely additional tenant-scoped notification producers under `supabase/functions/notify-*/index.ts`
- one new migration for stale-row cleanup

### Technical note
This is now primarily a data-consistency problem in `email_send_log`, not an actual delivery failure. The next implementation should focus on propagating `tenant_id` through the queue pipeline so the latest status row remains visible to tenant-scoped queries.
