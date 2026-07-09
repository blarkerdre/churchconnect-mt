
## What's actually happening

- **Certificate emails ARE sending.** `email_send_log` shows recent `certificate` rows going `pending → sent` (e.g. 2026-07-08 19:14). The certificate function already looks up/creates an `email_unsubscribe_tokens` row and includes `unsubscribe_token` in the enqueue payload.
- **Statement-of-Result emails are failing.** The queue rejects them with `400 missing_unsubscribe: "Transactional emails must include an unsubscribe_token"`, then retries 5× and drops to DLQ.

Root cause: `supabase/functions/send-statement-email/index.ts` enqueues the email without an `unsubscribe_token` field. All app emails going through Lovable's queue must include one.

## Fix

Single edit in `supabase/functions/send-statement-email/index.ts`, inside `sendForMember`, before the `enqueue_email` RPC call:

1. Normalize the recipient once: `const recipient = member.email.trim().toLowerCase();`
2. Look up an existing token in `email_unsubscribe_tokens` by that email.
3. If none, generate `crypto.randomUUID()` and upsert with `onConflict: 'email', ignoreDuplicates: true`, then re-read to get the stored token (handles race).
4. Add `unsubscribe_token: unsubToken` to the `enqueue_email` payload.
5. Use the same normalized `recipient` in the payload's `to` and in the `email_send_log` insert so lookups match the suppression/token tables consistently.

No changes needed to `issue-certificate` (already correct), to templates, or to the frontend. After the edit, redeploy `send-statement-email`.

## Verification

- Trigger "Send Statement of Result" from Course Results for a member with an email.
- `email_send_log` row goes `pending → sent` (not `failed`/`dlq`).
- No new `missing_unsubscribe` errors in `process-email-queue` logs.
