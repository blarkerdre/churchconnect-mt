# Why emails land in "DLQ" in System Logs

"DLQ" (dead-letter queue) means the email was given up on after repeated failures. There are 99 such rows since March; 7 of them are recent (today), all follow-up assignment emails.

## What the log data shows

Three distinct causes:

1. **Missing unsubscribe token (the current, ongoing one — follow-up assignment emails)**
   The first attempt is rejected with `400 missing_unsubscribe — "Transactional emails must include an unsubscribe_token"`. The follow-up notification sender queues the email without generating an unsubscribe token, unlike the other senders which do.

2. **Retries reuse the same idempotency key (makes cause 1 unrecoverable)**
   After the 400, the worker retries 5 times with the identical idempotency key, so the email API answers `409 — "This email send already failed. Send again with a new idempotency key."` every time. After 5 attempts the message is dead-lettered. This is why one bad send produces 6 error rows plus a DLQ row.

3. **Historical / already-resolved causes**
   - `TTL exceeded (15 minutes)` on 39 signup/recovery emails — all from 9 May, when the queue worker was not draining.
   - `Emails disabled for this project` (5 rows, March/April) and `domain_not_verified` (2 birthday greetings, June) — configuration issues since fixed.
   Those are stale history, not live failures.

## The fix

1. **Attach an unsubscribe token in the follow-up notification sender** — reuse the same get-or-create token logic the other senders already use, and include it in the queued payload.
2. **Audit the other senders that queue without a token** — the pastoral assignment, unit leader, home cell leader and exam grading senders queue the same way and will hit the identical 400 the moment they fire. Give them the same token handling.
3. **Make retries recoverable** — when the worker retries a message, derive a fresh idempotency key per attempt (e.g. `<message_id>:<attempt>`) so a retry is never rejected with 409.
4. **Fail fast on permanent errors** — treat a 400 `missing_unsubscribe` (and similar validation rejections) as permanent: dead-letter immediately with the real reason instead of burning 5 retries and masking it behind a 409.
5. **Re-send the affected follow-up notifications** once the fix is live, and confirm the System Logs email tab shows Sent for them.

No change to historical DLQ rows — they stay as an accurate record.

## Technical details

- `supabase/functions/notify-followup-assignment/index.ts` (~line 214): payload lacks `unsubscribe_token`; add the `email_unsubscribe_tokens` get-or-create block used in `send-transactional-email/index.ts` and `send-email-alert/index.ts`.
- Same gap in `notify-pastoral-assignment`, `notify-unit-leader`, `notify-wsf-leader`, `grade-exam` (all set `idempotency_key` but no token). Extract the token helper into `supabase/functions/_shared/` so there is one implementation.
- `supabase/functions/process-email-queue/index.ts`: pass `idempotency_key: \`${payload.idempotency_key}:${failedAttempts}\`` on send; add an `isPermanentValidationError(error)` check next to `isForbidden` that routes 400 validation failures straight to `moveToDlq`.
