# Why DLQ still shows in System Logs

## What the data says

The DLQ rows you can see are **history, not new failures**.

- Latest DLQ row: today 11:02 UTC (7 follow-up assignment emails between 08:32 and 11:02).
- Everything older is from June/July (unit tasks, transport, birthday greetings with an unverified domain).
- Since 11:03 UTC there have been **zero email log rows of any kind** — no email has been attempted since the fix was deployed, so nothing has proved the fix either way.

The 11:02 batch still shows the old pattern: first attempt rejected with `400 missing_unsubscribe`, then five retries rejected with `409 (idempotency key already failed)`, then dead-lettered. That is the exact behaviour the fix addresses, and the sender code now attaches an unsubscribe token before queueing.

So: the log is a permanent record — past DLQ entries never disappear on their own. What's missing is proof the next send succeeds.

## Plan

1. **Confirm the fix is live** — check the deployed version of the follow-up notification function and the queue worker actually carry the unsubscribe token and the per-attempt idempotency key.
2. **Trigger a real test send** — queue one follow-up assignment email and watch it through the log to a `sent` status.
3. **Re-send the 7 dead-lettered follow-up notifications** from this morning so those recipients actually get their email.
4. **Make old DLQ rows readable rather than alarming** — in the System Logs email tab, keep DLQ visible but show the failure reason inline and default the view to the last 7 days, so long-resolved June entries don't look like live incidents.
5. **Re-check the log** after the test to confirm no new DLQ rows appear.

## Technical details

- Verify deployed `notify-followup-assignment` includes `unsubscribe_token` (uses `_shared/unsubscribe-token.ts`) and that `process-email-queue` applies `isPermanentValidationError` → immediate `moveToDlq` plus `${idempotency_key}:${attempt}` on retries.
- Re-send: re-enqueue the 7 `followup-assign-*` message ids from `email_send_log` with fresh message ids so idempotency keys don't collide.
- No schema change; step 4 is display-only in `src/pages/SystemLogs.jsx`.
