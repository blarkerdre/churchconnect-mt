

## Fix: Signup Emails Still Showing "pending" — `tenant_id` Missing in `process-email-queue`

### Root cause
The `process-email-queue` edge function writes terminal status rows (`sent`, `failed`, `dlq`, `rate_limited`) to `email_send_log` **without `tenant_id`**, even though `payload.tenant_id` is available. The System Logs dashboard uses `scopeQuery` which filters by `tenant_id`, so terminal rows with NULL `tenant_id` are invisible — only the earlier `pending` row (which has `tenant_id`) appears.

There are **4 insert sites** in `process-email-queue/index.ts` that need fixing:
1. **Line 63** — DLQ log in `moveToDlq` helper
2. **Line 271** — Success (`sent`) log
3. **Line 298** — Rate-limited log
4. **Line 335** — Failed log

### Fix

**1. `supabase/functions/process-email-queue/index.ts`**
Add `tenant_id: payload.tenant_id || null` to all 4 `email_send_log` insert objects.

**2. Migration — backfill existing rows**
Update existing terminal rows that have NULL `tenant_id` by copying it from their matching `pending` row (same `message_id`):
```sql
UPDATE email_send_log t
SET tenant_id = p.tenant_id
FROM email_send_log p
WHERE t.message_id = p.message_id
  AND t.tenant_id IS NULL
  AND p.tenant_id IS NOT NULL
  AND p.status = 'pending'
  AND t.status IN ('sent','failed','dlq','rate_limited');
```

**3. Redeploy `process-email-queue`**

### Files changed
- `supabase/functions/process-email-queue/index.ts` — add `tenant_id` to all 4 log inserts
- 1 new migration — backfill existing terminal rows
- Deploy `process-email-queue`

