

## Fix: SMS Stuck at "Queued" — Twilio Webhook Blocked by JWT Verification

### Root cause

The `twilio-webhook` edge function is not listed in `supabase/config.toml`, so it defaults to `verify_jwt = true`. Twilio sends status callback requests without a JWT bearer token, meaning every webhook is rejected with 401 before the function code executes. The function already has its own HMAC-SHA1 signature validation, so JWT verification is unnecessary and harmful.

This is why:
- SMS is received by the recipient (Twilio accepted and delivered it)
- Status stays "queued" in the app (no webhook ever updates `sms_log`)
- There are zero logs for the `twilio-webhook` function

### Fix

1. **Add `twilio-webhook` to `supabase/config.toml`** with `verify_jwt = false`
   - The function already validates authenticity via Twilio HMAC-SHA1 signature checking
   
2. **Redeploy `twilio-webhook`** so the config takes effect

3. **No code changes needed** — the webhook handler logic is correct

### Files changed
- `supabase/config.toml` — add `[functions.twilio-webhook]` with `verify_jwt = false`

### Expected result
After this fix, Twilio status callbacks will reach the function, and `sms_log` rows will update from "queued" to "delivered" (or "failed"/"undelivered") in real time.

