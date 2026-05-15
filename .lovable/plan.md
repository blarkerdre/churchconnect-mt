## Why the tenant SMS limit isn't working

The quota check only lives inside the `send-sms` edge function. But most SMS in your project never goes through `send-sms` — many notification functions call Twilio / Africa's Talking / Termii **directly**, so the limit is silently bypassed.

Evidence from your live data — Cardiff tenant has `sms_limit_monthly = 50` but already sent **84** SMS this month:

| sms_type | count |
|---|---|
| join-request-notification | 64 |
| join-request-decision | 11 |
| followup | 9 |

None of those flow through `send-sms`. They're sent directly by:

- `notify-join-request`
- `notify-join-decision`
- `notify-followup-assignment`
- `notify-pastoral-assignment`
- `notify-transport-booking`
- `notify-unit-leader`
- `notify-wsf-leader`
- `process-scheduled-followups` (scheduled follow-up SMS)

Only `SMSDialog`, `MessageFilteredMembersDialog`, `process-scheduled-communications`, and `send-birthday-messages` use `send-sms`, so only those are gated.

A second issue: even inside `send-sms`, the count uses `.neq("status","failed")` which is correct, but the per-request guard is `recipients.length > remaining` — if you're already over the limit (e.g. 84/50) `remaining` is negative and any single send is still blocked, which is fine; but quotas counted today already include "uncountable" notify-* sends, so users see inconsistent remaining numbers in the UI.

## Plan

### 1. Centralise quota enforcement in a shared helper

Create `supabase/functions/_shared/sms-quota.ts` exporting:

- `checkSmsQuota(serviceClient, tenantId, channel, requested)` → returns `{ allowed, remaining, limit, usage }`, or throws a structured `QuotaExceededError`.
- `assertSmsQuota(...)` convenience wrapper that throws on exceed.

Logic mirrors the existing block in `send-sms/index.ts` (read `tenants.sms_limit_monthly` / `whatsapp_limit_monthly`, count `sms_log` since `date_trunc('month', now())` excluding `status='failed'`).

### 2. Refactor `send-sms` to use the helper

Replace the inline quota block with `assertSmsQuota`. Behaviour unchanged.

### 3. Add the helper to every direct-send function

For each function below, call `assertSmsQuota(serviceClient, tenant_id, "sms", recipients.length)` **before** dispatching to Twilio/AT/Termii. On `QuotaExceededError`, skip the SMS path (still send email/in-app where applicable) and log the skip:

- `notify-join-request`
- `notify-join-decision`
- `notify-followup-assignment`
- `notify-pastoral-assignment`
- `notify-transport-booking`
- `notify-unit-leader`
- `notify-wsf-leader`
- `process-scheduled-followups` (per scheduled message)

`make-call` is voice — out of scope for SMS quota; leave alone.
`refresh-sms-status` is a status poller — no sending; leave alone.

### 4. UI: surface remaining quota consistently

`Settings.jsx` already shows usage; no changes needed beyond it now reflecting reality once enforcement is universal.

In `SMSDialog.jsx`, keep the existing client-side pre-check as a UX hint (server is still source of truth).

### 5. Optional: ignore `recipient_phone IS NULL` rows

The `sms_log` count currently includes any non-failed row regardless of `channel`. Helper already filters by `channel`. Keep as-is.

## Technical details

```text
sms send paths (after fix)
─────────────────────────
SMSDialog ─────────────┐
MessageFilteredDialog ─┼─► send-sms ──► assertSmsQuota ──► provider
process-scheduled-comms┘                       │
process-scheduled-fups ──► assertSmsQuota ─────┤
notify-* (8 functions) ──► assertSmsQuota ─────┘──► provider
```

Helper signature:

```ts
export class QuotaExceededError extends Error {
  constructor(public channel, public limit, public usage) { super(...); }
}
export async function assertSmsQuota(client, tenantId, channel, requested = 1)
```

No DB schema changes required. No new migrations.

### Out of scope

- Per-month rollover/reset is automatic (uses `date_trunc('month', now())`).
- No retroactive crediting of the 84 over-quota Cardiff messages.
- Voice/email quotas are unchanged.

Shall I proceed with the implementation?
