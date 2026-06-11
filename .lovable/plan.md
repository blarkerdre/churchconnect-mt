# Fix: Transport booking & unit task emails DLQ'd

## Why
Tenant name "Winners Chapel International, Cardiff" contains a comma. Edge functions build the From header as `${name} <noreply@domain>`, which is invalid per RFC 5322 when the display name contains a comma, so the email provider rejects it with `400 invalid_email`. After 5 retries the message lands in DLQ.

## Fix
RFC-quote and escape the display name before composing the From header in every notifier that uses this pattern.

Helper (inline in each function, no shared file change needed):
```ts
const quoteName = (n: string) => `"${String(n ?? "").replace(/[\\"]/g, "\\$&")}"`;
const fromAddress = `${quoteName(churchShortName)} <noreply@${senderDomain}>`;
```

## Files to update
- `supabase/functions/notify-transport-booking/index.ts`
- `supabase/functions/notify-unit-task-assignment/index.ts`
- `supabase/functions/notify-pastoral-assignment/index.ts` (latent same bug)
- Sweep and patch any other `supabase/functions/notify-*` and `send-*` functions using the same `${churchShortName} <noreply@...>` pattern (e.g. follow-up, join-request, wsf-leader, welcome, event-reminders, birthday, course-registration).

## Verification
- After deploy, trigger a transport booking on the Cardiff tenant.
- Check `email_send_log`: new rows should reach `sent`, not `failed`/`dlq`.
- Optional: requeue or manually resend the DLQ'd transport messages once the fix is live.

## Not in scope
- Email queue/cron/Vault config — infrastructure is healthy; only the From header is malformed.
