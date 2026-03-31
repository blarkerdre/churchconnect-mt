
Fix the remaining email pipeline gap causing the dashboard to still show `pending`.

What I found
- The dashboard deduplication in both `src/pages/EmailDashboard.jsx` and `src/pages/SystemLogs.jsx` is correct: each keeps the latest row per `message_id`.
- `process-email-queue` now preserves `tenant_id` on terminal rows, but only if the queued payload contains `tenant_id`.
- `send-transactional-email` already enqueues `tenant_id`.
- The remaining issue is `supabase/functions/auth-email-hook/index.ts`:
  - it logs the initial `pending` row with `tenant_id`
  - but it does not include `tenant_id` in the `auth_emails` queue payload
  - so `process-email-queue` writes the later `sent`/`failed` row without `tenant_id`
  - tenant-scoped dashboard queries only see the earlier `pending` row

Implementation plan
1. Update `supabase/functions/auth-email-hook/index.ts`
- Add `tenant_id: resolvedTenantId` to the payload passed to `enqueue_email`.
- Keep the existing best-effort tenant resolution logic unchanged.

2. Backfill existing auth email terminal rows
- Add one migration to copy `tenant_id` from the matching `pending` row onto terminal rows with the same `message_id`.
- Include statuses: `sent`, `failed`, `dlq`, and `rate_limited`.
- Scope the source row to `status = 'pending'` so the backfill uses the original tenant-scoped entry.

3. Align dashboard status filters
- Update `STATUS_OPTIONS` / `EMAIL_STATUS_OPTIONS` and badge config to include `rate_limited`, since the queue writes that status and the current UI ignores it.

4. Verify all email log surfaces
- Confirm both `src/pages/EmailDashboard.jsx` and `src/pages/SystemLogs.jsx` will naturally show the later terminal row once the backfill and auth payload fix are in place.
- No dedupe rewrite is needed.

Files to change
- `supabase/functions/auth-email-hook/index.ts`
- `supabase/migrations/<new_migration>.sql`
- `src/pages/EmailDashboard.jsx`
- `src/pages/SystemLogs.jsx`

Technical detail
```text
Current auth flow:
pending row has tenant_id
auth-email-hook queue payload has no tenant_id
process-email-queue logs sent/failed with payload.tenant_id
=> terminal row tenant_id is NULL
=> tenant-scoped UI only sees pending

Fix:
auth-email-hook enqueues tenant_id
process-email-queue keeps propagating it
migration repairs older rows already written without it
```
