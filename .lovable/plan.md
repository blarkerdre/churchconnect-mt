
Fix the certificate email failure by updating the certificate sender to include a plain-text email body.

What I found
- The failing certificate messages are reaching the queue correctly.
- The queued certificate payload already includes `run_id`, `message_id`, `idempotency_key`, and `unsubscribe_token`.
- The email API error is specifically: `missing_parameter` with `parameter: "text"`.
- In `supabase/functions/issue-certificate/index.ts`, the certificate email payload includes `html` but does not include `text`.
- The queue dispatcher forwards `text: payload.text` to the email API, so certificate emails currently arrive without the required plain-text field.

Implementation plan
1. Update `supabase/functions/issue-certificate/index.ts`
   - Add a plain-text version of the certificate email alongside the existing HTML.
   - Include it in the queued payload as `text`.
   - Keep the existing unsubscribe token logic and queue metadata as-is.

2. Keep the email content aligned
   - Plain-text body should include:
     - member first name
     - training name
     - church name
     - certificate number
     - signed download link when available
   - This ensures the text and HTML versions stay consistent.

3. Redeploy and verify
   - Redeploy the `issue-certificate` backend function.
   - Trigger a fresh certificate issuance and confirm the queue processes it without the `missing_parameter:text` error.
   - Check the email logs for a `sent` status.

4. Handle already-failed messages
   - Existing failed/DLQ certificate messages will not be fixed automatically because they were queued without `text`.
   - After deployment, resend by issuing a new certificate email flow for affected members, or manually requeue only if needed.

Technical note
- No database change is needed.
- Root cause is isolated to the certificate email payload, not the queue processor.
- There may be other transactional email flows worth reviewing later for payload completeness, but the certificate failure itself is clearly caused by the missing `text` field.
