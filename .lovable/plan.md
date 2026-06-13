## Goal
Make the birthday-messages scheduler honor the tenant's local UK time so the configured `send_hour_local` (default 8) means 08:00 **Europe/London**, not 08:00 UTC. Today during BST the messages go out at 09:00 local; in winter they correctly send at 08:00.

## Root cause
`supabase/functions/send-birthday-messages/index.ts` compares `todayUtc.getUTCHours()` directly against `t.send_hour_local`. There is no timezone conversion, so "8" is interpreted as UTC.

Also: the "is it the member's birthday" check uses UTC date (`todayMM/todayDD`). Near midnight UK time that can shift the birthday by a day when the UTC date has already rolled over but London hasn't (winter) or hasn't yet (summer near midnight). For an 08:00-local send window this is currently benign, but we'll fix it in the same pass so future hour changes don't introduce a regression.

## Changes (single edit, one file)
`supabase/functions/send-birthday-messages/index.ts`:

1. Replace the UTC clock/date with London-local equivalents using `Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', ... })`:
   - `londonHour` (0-23) — used for the cron-mode gate.
   - `londonMM` / `londonDD` / `londonDate` (YYYY-MM-DD) — used for the birthday match, the idempotency `sent_on`, and the failed-row update.
2. Gate becomes: `if (!isManual && londonHour !== (t.send_hour_local ?? 8)) continue;`
3. Birthday filter uses `londonMM` / `londonDD`.
4. Log insert/update uses `londonDate` for `sent_on`.

No DB migration, no UI change, no other functions touched. Cron continues to fire hourly; the function self-gates on the correct local hour.

## Verification
- Redeploy `send-birthday-messages`.
- Manually invoke at a non-8 UTC hour with `{ tenant_id }`: still works (manual path bypasses the gate).
- At 08:00 London (07:00 UTC in BST) the next hourly cron tick runs the send; confirm a new row in `birthday_message_log` with `sent_on` = today's London date.
- Confirm no double-send by re-running cron within the same London day — unique `(tenant_id, member_id, channel, sent_on)` blocks it.

## Out of scope
- Per-tenant timezone (all current tenants are UK; can be added later by reading a `timezone` column on `tenants`).
- Retrying failed channels.
- Fixing per-member data gaps (missing `user_id`, `phone`, `email`).
