
Goal: eliminate the recurring `404 run_not_found` email failure in a way that is robust even if an old payload slips into the queue again.

What I found
- In the current codebase, app-email senders already omit `run_id`:
  - `supabase/functions/issue-certificate/index.ts`
  - `supabase/functions/notify-followup-assignment/index.ts`
  - `supabase/functions/notify-pastoral-assignment/index.ts`
  - `supabase/functions/send-welcome-email/index.ts`
- The only valid `run_id` usage left is in `auth-email-hook`, which is correct for auth emails.
- `process-email-queue` still forwards `run_id` whenever it exists in the queued payload, regardless of queue type.
- Backend logs show historical `run_not_found` failures for:
  - `certificate`
  - `welcome-registration`
- Later entries for both flows show successful sends, and the transactional queue is currently empty.

Planned fix
1. Harden the queue worker
- Update `supabase/functions/process-email-queue/index.ts` so `run_id` is only ever forwarded for the `auth_emails` queue.
- For `transactional_emails`, explicitly ignore any `run_id` found in the payload.
- This makes the system safe even if a stale or malformed app-email payload is retried later.

2. Re-verify all app-email producers
- Confirm the certificate, welcome email, follow-up assignment, and pastoral assignment flows all continue to send only:
  - `idempotency_key`
  - `message_id`
  - `purpose: "transactional"`
  - `text` and `html`
  - `unsubscribe_token` where required
- No backend/database schema changes are needed for this step.

3. Redeploy the relevant backend functions together
- Redeploy:
  - `process-email-queue`
  - `issue-certificate`
  - `send-welcome-email`
  - optionally the other app-email functions as a consistency sweep
- This ensures the live backend matches the repository, rather than relying on prior deployments.

4. Clean up legacy retry noise if needed
- Check for any queued or dead-letter app-email messages that still carry legacy payloads.
- If any are found, remove/quarantine only those legacy items instead of broad queue cleanup.
- Leave normal historical logs intact for audit purposes.

5. Re-test the two proven failure paths
- Trigger:
  - certificate issuance
  - public registration / welcome email
- Confirm each message moves from `pending` to `sent` with no new `run_not_found` entries.

Technical note
- The durable fix is not just “remove `run_id` from senders”; it is to make the queue worker enforce the rule:
  - auth emails may use `run_id`
  - app emails must never forward `run_id`
- That gives protection against stale payloads, partial deploy drift, and future regressions.
