
Fix the transactional email pipeline so QR-code registrations actually send welcome emails.

1. Confirmed root cause
- The registration itself is succeeding: a fresh member row was created for the latest QR registration.
- The sender domain is already verified, so this is not a DNS/domain issue.
- Auth emails are working, which means the email infrastructure is generally live.
- The failure is in the queue dispatcher: recent `welcome-registration` entries show repeated `400 missing_parameter run_id` errors, then the email is moved to the dead-letter queue.
- `auth-email-hook` includes `run_id` in queued payloads, but transactional senders like `send-welcome-email` do not.

2. Implementation plan
- Update `supabase/functions/process-email-queue/index.ts`
  - Make the dispatcher resilient by always passing a valid run identifier to the email sender.
  - Use a fallback chain like:
    - `payload.run_id`
    - else `payload.message_id`
    - else `payload.idempotency_key`
    - else generate a UUID
  - This fixes already-queued/future transactional emails even if one producer forgets `run_id`.

- Update all transactional email producers to include `run_id` explicitly for consistency:
  - `supabase/functions/send-welcome-email/index.ts`
  - `supabase/functions/send-email-alert/index.ts`
  - `supabase/functions/notify-followup-assignment/index.ts`
  - `supabase/functions/notify-pastoral-assignment/index.ts`

- Keep `auth-email-hook` as-is
  - It already supplies `run_id`, so no functional change is needed there.

3. Recovery step after the code fix
- Re-trigger the welcome email for the latest QR registration so the user actually receives it.
- I’ll verify delivery by checking:
  - the edge function response,
  - the email log status,
  - and that the latest record moves from `pending/failed` to `sent`.

4. Why this is the right fix
- It solves the immediate QR registration issue.
- It also prevents the same hidden bug from breaking other transactional emails later.
- No database schema changes are needed.

5. Technical details
```text
Current flow
QR registration -> member created -> welcome email queued
               -> process-email-queue calls email sender with payload.run_id
               -> payload.run_id is missing
               -> provider returns 400 missing_parameter run_id
               -> retries exhausted -> DLQ

Fixed flow
QR registration -> member created -> welcome email queued with run_id
               OR dispatcher supplies fallback run_id
               -> email sender accepts request
               -> email logged as sent
```

Files involved
- `supabase/functions/process-email-queue/index.ts`
- `supabase/functions/send-welcome-email/index.ts`
- `supabase/functions/send-email-alert/index.ts`
- `supabase/functions/notify-followup-assignment/index.ts`
- `supabase/functions/notify-pastoral-assignment/index.ts`

Verification
- Trigger a fresh welcome email after the fix
- Check latest `email_send_log` entry for `welcome-registration`
- Confirm final status is `sent`
