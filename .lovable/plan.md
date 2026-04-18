
## Plan: Fix "queued" SMS and call statuses

### Root causes
1. **SMS** — Older messages were sent without a `StatusCallback` URL or before the webhook was reachable, so `delivery_status` is stuck at `queued` even though Twilio actually delivered them. Recent sends (Apr 18) update correctly.
2. **Calls** — `make-call` inserts `status: 'queued'` but never sends a `StatusCallback` to Twilio, and `twilio-webhook` only handles SMS — so calls have no way to ever leave "queued".

### Fix

#### A. Display fix (immediate, no waiting on Twilio)
**Edit** `src/components/sms/SMSHistoryDialog.jsx`:
- In `getStatusDisplay`: when `status === 'sent'` and `delivery_status` is `queued`/`accepted`/`scheduled`/`null`, label as **"Sent"** (not "Queued"). True queued state only when message was just submitted within last ~2 minutes.
- Remove the "Multiple messages stuck in queued" alert banner — replace with a **Refresh status** button (next item).

#### B. Manual status refresh for stuck SMS
**New edge function** `supabase/functions/refresh-sms-status/index.ts`:
- Auth: tenant admin only.
- Inputs: `tenant_id`, optional `message_sids[]` or "all stuck in last 30 days".
- For each row with `status='sent'` AND `delivery_status` IN (`queued`,`accepted`,`sending`,null) AND `message_sid` NOT NULL AND `provider='twilio'`:
  - GET `https://connector-gateway.lovable.dev/twilio/Messages/{Sid}.json`
  - Update `sms_log` with the live `status` from Twilio (`delivered`/`failed`/`undelivered`/`sent`) into `delivery_status` + mirror into `status` when terminal.
- Return `{ updated, unchanged, failed }`.

**Edit** `SMSHistoryDialog.jsx`: add a small **"Refresh delivery"** button (top-right of header) that invokes this function and refetches the list.

#### C. Call status callbacks
**Edit** `supabase/functions/make-call/index.ts`:
- For Twilio branch, add `StatusCallback`, `StatusCallbackEvent` (`initiated completed`), `StatusCallbackMethod=POST` to the params, pointing at the existing `twilio-webhook`.

**Edit** `supabase/functions/twilio-webhook/index.ts`:
- Detect `CallSid` + `CallStatus` in the form params (in addition to `MessageSid`). When present:
  - Map Twilio statuses (`queued/ringing/in-progress/completed/busy/failed/no-answer/canceled`) → our `call_log.status`.
  - `UPDATE call_log SET status=?, updated_at=now() WHERE provider_call_id = CallSid AND tenant_id = (resolved via the existing row)`.
- Keep existing SMS branch untouched.

**Migration**: add `delivery_status text`, `delivery_updated_at timestamptz` columns to `call_log` if not present, plus an `updated_at` column with default `now()` (currently missing — caused our earlier query error). Add an UPDATE trigger to bump `updated_at`.

#### D. Polish: surface in CallHistoryDialog (if exists) the same way
Quick scan — if a call history dialog exists, apply the same display normalization (`queued` < 2min = Pending, otherwise "Initiated").

### Files
**New**
- `supabase/functions/refresh-sms-status/index.ts`
- `supabase/migrations/<ts>_call_log_delivery_columns.sql`

**Edit**
- `src/components/sms/SMSHistoryDialog.jsx`
- `supabase/functions/make-call/index.ts`
- `supabase/functions/twilio-webhook/index.ts`

### Out of scope
- Backfilling call statuses for the single existing stuck call (one row, can be done manually if needed).
- Provider-side status polling for non-Twilio providers (Africa's Talking / Termii) — they have different callback patterns; can be added later if needed.
