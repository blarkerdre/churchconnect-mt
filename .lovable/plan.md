

## Fix: Emails Still Failing with "Invalid 'from' email address"

### Root cause

The `send-email-alert` edge function source code IS correct (lines 170-172 use `fromDomain = 'app.churchmanagementsuite.org'`), but the **deployed function is still running the old code**. Evidence:

- 3 email-alert messages were enqueued at 18:14 today and immediately failed at 18:15 with `Invalid 'from' email address` — meaning the deployed `send-email-alert` is still embedding the old `notify.app.churchmanagementsuite.org` in the `from` field
- All 3 exhausted 5 retries and moved to DLQ by 18:17
- The `pending` log entries for these 3 emails are orphans — their queue messages are gone

There are also 33 older `pending` rows (signup, welcome-registration, tenant-invitation templates) that DO have corresponding `sent` rows when deduplicated by `message_id`. These display correctly in the dashboard thanks to deduplication. The dashboard itself is working correctly.

### Two issues to fix

**Issue 1: Redeploy `send-email-alert`**
The function must be redeployed so the corrected `from` address takes effect. No code changes needed — source is already correct.

**Issue 2: Clean up orphan pending/failed rows**
36 `pending` rows and 33+ `failed` rows from today's email-alert sends are cluttering the log. The stale `pending` rows (whose queue messages are gone or have corresponding sent/failed/dlq entries) should be cleaned up.

### Plan

1. **Redeploy `send-email-alert`** — ensure the fixed code is actually live
2. **Run cleanup migration** — mark orphan `pending` rows as resolved:
   ```sql
   UPDATE email_send_log
   SET status = 'failed',
       error_message = 'Stale orphan: resolved by newer log entry for same message'
   WHERE status = 'pending'
     AND created_at < now() - interval '30 minutes'
     AND message_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM email_send_log e2
       WHERE e2.message_id = email_send_log.message_id
         AND e2.status IN ('sent', 'failed', 'dlq')
         AND e2.created_at > email_send_log.created_at
     );
   ```
3. **Test** — send a new email alert to verify the fix is live

### Files changed
- No code edits — source is already correct
- 1 database migration for cleanup
- 1 edge function redeploy

