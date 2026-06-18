# Fix "pending" appearing in tenant email logs

## Root cause

`email_send_log` rows for the same email share a `message_id` but are written in two phases:

1. **enqueue** — written by the app/Edge Function that triggers the email, with the correct `tenant_id`. Status: `pending`.
2. **delivery** — written by the shared `process-email-queue` Edge Function as service role. It does NOT copy `tenant_id` from the pending row, so it writes `tenant_id = NULL`. Status: `sent` / `dlq` / `failed` / `suppressed`.

Tenant-scoped log views (System Logs, Email Dashboard) filter with `.eq("tenant_id", tenantId)`. The `sent` row's NULL tenant is filtered out, so only the `pending` row survives and the email looks stuck.

## Fix

### 1. Edge Function: `process-email-queue`

When writing the post-delivery `email_send_log` row (`sent`, `dlq`, `failed`, `suppressed`), look up the original `pending` row by `message_id` and copy its `tenant_id` onto the new row.

Approach (minimal change):
- Before insert, run `SELECT tenant_id FROM email_send_log WHERE message_id = $1 AND tenant_id IS NOT NULL ORDER BY created_at ASC LIMIT 1`.
- Include the resolved `tenant_id` in the insert payload. If no pending row found (edge case), leave NULL.

Deploy `process-email-queue` after the change.

### 2. Backfill historical rows

One-off SQL: for every `email_send_log` row where `tenant_id IS NULL`, set it to the `tenant_id` of the earliest non-null row sharing the same `message_id`.

```sql
UPDATE email_send_log target
SET tenant_id = src.tenant_id
FROM (
  SELECT DISTINCT ON (message_id) message_id, tenant_id
  FROM email_send_log
  WHERE tenant_id IS NOT NULL
  ORDER BY message_id, created_at ASC
) src
WHERE target.message_id = src.message_id
  AND target.tenant_id IS NULL;
```

Run via the data/insert tool (it's an UPDATE on existing data, not a schema change).

### 3. No UI changes needed

Both `src/pages/SystemLogs.jsx` and `src/pages/EmailDashboard.jsx` already deduplicate by `message_id` and pick the latest row. Once both rows carry the same `tenant_id`, the dashboards will correctly show `sent`.

## Out of scope

- Changing the deduplication logic.
- Adding cross-tenant fallbacks in the UI (would leak other tenants' email rows).
- Touching the auth-email-hook or send-transactional-email enqueue paths (they already set `tenant_id` correctly).

## Verification

After deploy + backfill:
- Re-run `SELECT * FROM email_send_log WHERE message_id = '88caec87-342a-4342-8858-bb07929f6251'` — both rows should have `tenant_id = 95e53cc3-4569-4dd3-a4ad-3489593dce81`.
- WCI Cardiff System Logs should show Lilian's signup email as **sent**, not pending.
- Trigger a new test email and confirm both phases write the same `tenant_id`.
