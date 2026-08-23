# Follow-up sending and "pending" emails in System Log

## What I found

**1. Emails are not actually stuck — the log is double-counting.**
Every email writes two rows: one "pending" when it is queued and one "sent"
when it goes out, sharing the same message ID. The System Log's Email tab
lists raw rows without collapsing those pairs, so each delivered email still
shows a leftover "pending" entry. Collapsed properly, the true picture is
1,281 sent (latest today 09:56), 9 genuinely pending (all from 8 Aug), 65
dead-lettered, 4 failed, 10 bounced. Email delivery itself is working.

**2. Follow-up notifications are being rejected with 401.**
Every time a follow-up is created or reassigned, the database calls the
notification and push functions using an old backend key. Each call comes
back `401 Unauthorized` / `Invalid token` — 7 rejected calls at 09:56 today,
same at 09:53, and the same pattern all day. So assignment alerts and push
notifications for follow-ups never arrive.

**3. The Send Email / Send SMS buttons don't send anything themselves.**
They only write the message into a queue. A background job drains that queue
every 5 minutes. That job was returning 403 until yesterday's fix; it now
returns 200, but nothing has actually been dispatched through it yet, so the
end-to-end path is unproven. The 8 messages currently queued are automatic
template reminders scheduled 6–16 hours ahead, not user-clicked sends — which
is why nothing appears to go out. Diagnosis for this item is: the auth block
is cleared, the delivery path still needs a live test.

## The fix

1. **Verify the send path end-to-end.** Queue one real follow-up message with
   an immediate send time, watch the background job run, and confirm it moves
   to "sent" with the SMS/email provider accepting it. If the downstream
   sender rejects it, fix that too.
2. **Make the buttons feel like sending.** When "Send Now" is chosen, dispatch
   the message immediately instead of waiting up to 5 minutes for the queue
   job, and show the real outcome (sent / failed with reason) in the dialog
   instead of a generic "queued" toast.
3. **Fix the follow-up notifications.** Switch the database triggers that call
   the notification and push functions over to the rotation-proof job token
   already used by the scheduled jobs, so they stop returning 401.
4. **Fix the System Log Email tab.** Collapse rows by message ID so each email
   appears once with its latest status, and correct the summary counters
   (Sent / Pending / Failed) to match.

## Technical detail

- `src/pages/SystemLogs.jsx` reads `email_send_log` raw; apply the existing
  `dedupeByMessageId` helper from `src/lib/dedupe-email-log.js` before
  rendering rows and computing `stats`.
- `notify_followup_reassignment` and the notification loop inside
  `auto_create_followup` post to `notify-followup-assignment` / `send-push`
  with a stale service key. Move both to the `x-job-token` header pattern and
  extend `_shared/scheduler-auth.ts` acceptance into those two functions.
- Immediate send: have `FollowupMessageDialog` invoke
  `process-scheduled-followups` (or a small direct-send path) right after the
  insert when `sendMode === "now"`, then surface the returned status.
- No change to the 5-minute cron schedule or the nightly stale-message sweep.
