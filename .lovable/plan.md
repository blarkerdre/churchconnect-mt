## Goal
Stop `unit-task-assignment` and `transport-booking-notification` emails from being rejected and DLQ'd by the transactional send API.

## Root causes (from email_send_log)
1. `unit-task-assignment` → API 400 `missing_unsubscribe`: the enqueue payload omits `unsubscribe_token`.
2. `transport-booking-notification` → mostly resolved; some old DLQs from `invalid_email "from"` caused by an empty/whitespace tenant sender name producing `"" <noreply@…>`.

## Changes

### 1. `supabase/functions/notify-unit-task-assignment/index.ts`
Before each email enqueue (inside the `if (email)` block):
- Normalize the recipient: `const normalizedEmail = email.trim().toLowerCase()`.
- Look up an existing unused token in `email_unsubscribe_tokens` for that email; if none, insert a new `crypto.randomUUID()` token and use it; on insert error, re-query.
- If no token can be resolved, log and `continue` (skip the send) instead of enqueuing a doomed message.
- Add `unsubscribe_token: unsubscribeToken` to the `enqueue_email` payload.

### 2. `supabase/functions/notify-transport-booking/index.ts`
Harden From-address construction in both branches (driver-availability and main):
- Trim `churchName` / `churchShortName`; if blank, fall back to `"Church"`.
- Strip control chars and collapse whitespace before quoting.
- Keep existing backslash-escape of `\` and `"`.

No other modules, schemas, or UI touched.

## Verification
- Redeploy both edge functions.
- Trigger one unit-task assignment and one transport booking; confirm new rows in `email_send_log` go `pending → sent` (no `missing_unsubscribe` / `invalid_email`).
- Re-check `status='dlq'` rows for these templates after 24h — none should appear with the same error.

## Out of scope
- Replaying the historic DLQ messages.
- Refactoring shared unsubscribe-token logic into `_shared/` (can follow later if more functions need it).
