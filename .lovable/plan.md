
## Root cause

`notify-join-request` enqueues directly to `transactional_emails` with `purpose: "transactional"` but **omits `unsubscribe_token`**. The Lovable Email API rejects with `400 missing_unsubscribe`, which the queue retries 5× then sends to DLQ. Every other notify/send function in this project (welcome, course-registration, email-alert, certificates) follows the same upsert-token-then-include-it pattern.

## Fix

**Edit** `supabase/functions/notify-join-request/index.ts`:

For each approver email, before building the payload:
1. Look up an existing token in `email_unsubscribe_tokens` for the recipient email (case-normalized).
2. If none, insert a new `crypto.randomUUID()` token, then re-read to handle the unique-conflict race.
3. Add `unsubscribe_token: <token>` to the payload sent to `enqueue_email`.

This matches `send-welcome-email` / `send-course-registration-email` exactly so behaviour stays consistent (one token per address, idempotent across retries).

## Cleanup of stuck rows

The 4 DLQ rows in `email_send_log` for `join-request-notification` are terminal — no auto-resend. After the fix is deployed, future requests will send correctly. Optionally re-trigger the original notifications by calling `notify-join-request` again for the two outstanding pending requests (no DB cleanup needed; new sends use fresh `message_id`s).

## Files
- **Edit**: `supabase/functions/notify-join-request/index.ts`

## Out of scope
- Refactoring all bespoke senders to call `send-transactional-email` (separate cleanup).
- Manual DLQ replay (covered by re-invocation).
