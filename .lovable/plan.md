

## Fix: Email Dashboard Shows "pending" Instead of "sent"

### Root cause
The email pipeline creates two log rows per email sharing the same `message_id`:
1. A `pending` row (written by the originating function, e.g. `send-transactional-email`) — **includes `tenant_id`**
2. A `sent`/`dlq`/`failed` row (written by `process-email-queue`) — **missing `tenant_id`**

The Email Dashboard filters by `tenant_id` via `scopeQuery`. Because the terminal-status row has no `tenant_id`, it gets excluded. Only the `pending` row survives the filter, so the dashboard incorrectly shows emails as "pending" even after they've been sent.

### Fix (2 files)

**1. `supabase/functions/send-transactional-email/index.ts`** — Add `tenant_id` to the queue payload so `process-email-queue` can propagate it:

Add `tenant_id: tenantId` to the payload object passed to `enqueue_email` (around line 321-334), alongside `message_id`, `to`, `from`, etc.

**2. `supabase/functions/process-email-queue/index.ts`** — Include `tenant_id` from the payload in all `email_send_log` inserts:

Update all 4 insert locations (lines ~63, ~271, ~298, ~335) to include:
```ts
...(payload.tenant_id ? { tenant_id: payload.tenant_id } : {}),
```

This ensures terminal status rows (`sent`, `dlq`, `failed`, `rate_limited`) carry the same `tenant_id` as the initial `pending` row, so the dashboard's tenant-scoped query returns the latest status correctly.

### Also: backfill existing rows
One migration to fix existing `sent`/`dlq` rows that are missing `tenant_id` by copying it from the matching `pending` row with the same `message_id`:

```sql
UPDATE email_send_log target
SET tenant_id = source.tenant_id
FROM email_send_log source
WHERE target.message_id = source.message_id
  AND target.tenant_id IS NULL
  AND source.tenant_id IS NOT NULL
  AND target.status IN ('sent', 'dlq', 'failed');
```

### No UI changes needed
The `EmailDashboard.jsx` deduplication logic is correct — once terminal rows have `tenant_id`, it will naturally show the latest status.

### Files changed
- `supabase/functions/send-transactional-email/index.ts` — add `tenant_id` to queue payload
- `supabase/functions/process-email-queue/index.ts` — propagate `tenant_id` from payload into all log inserts
- 1 new migration — backfill `tenant_id` on existing terminal-status rows

