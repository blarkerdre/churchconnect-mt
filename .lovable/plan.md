## Why no sound

Edge function logs show every push attempt failing with:
`push send error: 403 permission denied: invalid JWT provided`

This means the DB trigger reaches the Edge Functions gateway, but the gateway rejects the call before `send-push` runs — so no Web Push is ever delivered to the device. Separately, the in-app chime only plays when the tab is open, so on a locked phone you'd hear nothing either way.

## Fix

### 1. Disable JWT verification on `send-push`
Add to `supabase/config.toml`:
```
[functions.send-push]
  verify_jwt = false
```
The function is only invoked by our DB trigger (using the service-role key from vault as a shared secret in the payload pattern) and is not user-facing. This matches how `auth-email-hook`, `twilio-webhook`, `stripe-subscription-webhook`, etc. are configured.

### 2. Add a shared-secret guard inside `send-push`
Since we're turning off gateway JWT checks, validate the caller in code. The trigger already has access to the `email_queue_service_role_key` vault secret — reuse it:
- Trigger passes `Authorization: Bearer <service_role_key>` (already does).
- `send-push/index.ts` checks `req.headers.get("authorization")` equals `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` and rejects with 401 otherwise.

### 3. Verify end-to-end
After deploy:
- Insert a test row into `public.notifications` for the logged-in user.
- Confirm `send-push` logs show 201/200 from the push provider instead of 403.
- Confirm the device shows a system notification (with the new chime / vibration from `sw.js`).

### 4. In-app chime sanity check
While we're in there, confirm `triggerNotificationAlert` is actually being called. The realtime handler in `NotificationBell.jsx` already calls it, but the user is on `/index` viewport 384px — they may not have clicked "Enable" yet. No code change needed unless step 3 still shows no audio; if so, we'll add a one-line `console.debug` in the realtime callback to confirm it fires.

## Files

- `supabase/config.toml` — add `[functions.send-push] verify_jwt = false`
- `supabase/functions/send-push/index.ts` — add bearer-token check against `SUPABASE_SERVICE_ROLE_KEY`

No DB migration, no client changes.
