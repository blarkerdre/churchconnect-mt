

## Fix: Follow-up Assignment Notification Failing with 401

### What I found

**Issue 1 — Assignment notification to unit member: NOT delivered**
The `net._http_response` table shows the latest call to `notify-followup-assignment` returned `401 {"error":"Invalid token"}` at 14:01:49. The vault secret `email_queue_service_role_key` is stale again and doesn't match the edge function's `SUPABASE_SERVICE_ROLE_KEY` env var.

**Issue 2 — Follow-up reminder to first timer: Actually IS delivered (email only)**
The `email_send_log` shows `followup-reminder` emails successfully sent (status=`sent`) to `blarkerdre@yahoo.com`. The SMS channel failed because the member record has no phone number — Twilio rejects with "Invalid 'To' Phone Number: X".

### Fix

1. **Refresh vault secrets** — Run `setup_email_infra` to resync `email_queue_service_role_key` with the current service role key. This fixes the 401 error blocking assignment notifications.

2. **No code changes needed** — The trigger logic and edge function code are correct. The only issue is the stale vault secret.

### About the SMS failures
The SMS failures for first timer reminders are because those members don't have phone numbers in their records. This is expected behavior — the system correctly falls back to email-only delivery. If SMS is needed, ensure members have valid phone numbers.

### Verification after fix
- Create a new first timer or reassign a follow-up task
- Check `email_send_log` for a new `followup-assignment` entry with status `sent`
- Check `sms_log` for a new `followup-assignment` entry (if the unit member has a phone number)

### Files changed
- None — infrastructure refresh only (vault secret update)

