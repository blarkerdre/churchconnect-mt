
## SMS still shows `queued` — updated diagnosis

### What I found
- `twilio-webhook` is already configured with `verify_jwt = false` in `supabase/config.toml`.
- `supabase/functions/twilio-webhook/index.ts` already validates against the public webhook URL:
  `https://qfordhikmtgedfybktjg.supabase.co/functions/v1/twilio-webhook`
- Recent webhook logs still show:
  - `Invalid Twilio signature — rejecting webhook`
  - with the correct public URL
- Recent `sms_log` rows are still stuck at `status = sent`, `delivery_status = queued`, with no `delivery_updated_at`.
- Available secrets currently include `TWILIO_AUTH_TOKEN`, but no subaccount token secret is present.

### Most likely root cause
The webhook is now failing for a narrower reason: it is probably validating every callback with the parent `TWILIO_AUTH_TOKEN`, while the messages are being sent through a Twilio subaccount via the linked Twilio connection. In that case, Twilio signs delivery callbacks with the subaccount’s auth token, so signature validation will always fail until the webhook selects the correct token based on `AccountSid`.

## Implementation plan

### 1) Update `twilio-webhook` to choose the signing token by `AccountSid`
In `supabase/functions/twilio-webhook/index.ts`:
- parse the webhook form body first
- read `AccountSid` from the payload
- compare it against configured account IDs
- choose the matching auth token before computing the HMAC

Planned fallback logic:
- if callback `AccountSid` matches `TWILIO_SUBACCOUNT_SID`, use `TWILIO_SUBACCOUNT_AUTH_TOKEN`
- otherwise use existing `TWILIO_AUTH_TOKEN`

This keeps current behavior working for the main account while supporting subaccounts safely.

### 2) Add defensive diagnostics
Improve webhook logging so debugging is clearer without exposing secrets:
- log whether the callback used primary vs subaccount token path
- log the incoming `AccountSid`
- log a specific warning if callback `AccountSid` has no matching configured token

This will make future SMS delivery issues much easier to diagnose.

### 3) Add the missing secrets if needed
Because the project currently only has `TWILIO_AUTH_TOKEN`, implementation will also need these secrets if the linked Twilio account is using a subaccount:
- `TWILIO_SUBACCOUNT_SID`
- `TWILIO_SUBACCOUNT_AUTH_TOKEN`

If the callback `AccountSid` equals the primary account SID, no extra secret is needed. But based on current evidence, I expect the subaccount secrets will be required.

### 4) Keep the rest of the pipeline unchanged
No changes should be needed in:
- `supabase/functions/send-sms/index.ts`
- `supabase/config.toml`
- `sms_log` schema
- frontend/System Log UI

Those parts are already doing the right thing. The failure is in webhook signature validation.

### 5) Verify end to end
After implementation:
- send a fresh test SMS
- confirm `twilio-webhook` logs show successful processing instead of signature rejection
- confirm the matching `sms_log` row changes from:
  - `sent / queued`
  to
  - `delivered`
  or `failed` / `undelivered`

## Files to update
- `supabase/functions/twilio-webhook/index.ts`

## Expected result
SMS that are actually received will stop appearing permanently queued in System Log, because Twilio delivery callbacks will finally validate and update `sms_log` correctly.
