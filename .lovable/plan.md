## Why no test message arrived

The `send-birthday-messages` edge function filters recipients to only members whose `date_of_birth` matches today's UTC month/day (lines 120–126). The "Send test to me" button in Birthday Messages settings passes your `member_id`, but if today isn't your birthday the recipient list is empty — so `processed=0, sent=0, failed=0`, the toast shows "0 sent · 0 failed", and nothing is dispatched. The `birthday_message_log` table is also empty, confirming nothing ran.

## Fix

In `supabase/functions/send-birthday-messages/index.ts`:

1. Treat the request as a **test send** when `member_id` is provided (already tracked as `isManual`).
2. When `isManual` is true:
   - Skip the today-only DOB filter so the recipient is always included.
   - Skip the idempotency log insert (or use a `test-` prefixed `sent_on`/separate code path) so repeated tests aren't blocked by the unique constraint, and so they don't pollute real birthday history.
   - Use a unique `idempotencyKey` per test (e.g. include a timestamp) so the email queue doesn't dedupe successive tests.
3. Bypass member-not-found when the only member returned has no DOB (still send the test).
4. Keep the cron path (no `member_id`) unchanged — real sends still require today = DOB.

## Result

Clicking "Send test to me" will deliver the configured channels (in-app / email / SMS / WhatsApp) to your own member record any day, with no impact on the real birthday cron logic.
