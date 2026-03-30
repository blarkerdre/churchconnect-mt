

## Fix: Stale "Pending" Email Logs & Verify Deployment

### What happened
- All email-alert messages were queued **before** the `from` address fix was deployed
- They all failed with `Invalid 'from' email address` and moved to DLQ after 5 retries
- 3 `pending` log entries remain as orphans — their queue messages are gone (already failed/DLQ'd), so nothing will ever update them to `sent`
- The code fix (using `app.churchmanagementsuite.org` as FROM_DOMAIN) is correct in the source

### Plan

1. **Redeploy `send-email-alert`** — ensure the fixed code is live (the function may not have been redeployed after the edit)

2. **Clean up stale pending rows** — run a migration to mark the 3 orphan `pending` rows as `failed` so they don't confuse the UI:
   ```sql
   UPDATE email_send_log
   SET status = 'failed', error_message = 'Stale: queued before from-address fix'
   WHERE status = 'pending'
     AND template_name = 'email-alert'
     AND created_at < now() - interval '10 minutes';
   ```

3. **Test** — send a new email alert to verify emails now process successfully

### Files changed
- No file edits needed — code is already correct
- 1 database migration to clean orphan rows
- 1 edge function redeploy

