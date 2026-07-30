## What I found

- Birthday email and in-app messages are sending fine (last sends recorded today, 30 Jul).
- Birthday SMS has worked on most birthdays (22, 19, 16, 14, 13 Jul all delivered, visible in System Logs → SMS).
- Today's birthday SMS to Providence Adesanya failed: the messaging function returned a gateway error (502) before writing anything, so **no row exists in the SMS log** and nothing shows in System Logs. The failure is only recorded in the internal birthday log, which System Logs does not display.
- There is no birthday voice-call channel, so the Calls log is expected to be empty for birthdays (out of scope per your choice).

## Plan

1. **Never lose a failure again**
   - In the birthday sender, when the SMS/WhatsApp call fails (non-2xx, timeout, or gateway error), write a `failed` row into `sms_log` with tenant, member, phone, channel, `sms_type = 'birthday'`, and the error text — so it appears in System Logs → SMS/WhatsApp alongside successful sends.

2. **Retry transient failures**
   - Retry the send up to 3 times with short backoff (1s, 3s) for gateway/5xx/network errors only. Do not retry validation errors (no phone, quota exceeded, invalid number).
   - Only mark the birthday log row `failed` after the retries are exhausted; mark it `sent` if a retry succeeds.

3. **Same treatment for email**
   - Apply the same retry-on-5xx logic to the birthday email call so a transient blip doesn't silently skip a member.

4. **Make failures re-runnable**
   - Because a failed row is recorded, a later run today would be skipped by the once-per-day rule. Change the idempotency check so rows still marked `failed` are retried on the next hourly run of the same day, while `sent` rows stay skipped.

5. **Re-send today's missed message**
   - After the fix, trigger the sender for that member so today's birthday SMS actually goes out, then confirm a row appears in System Logs → SMS.

## Technical notes

- Files: `supabase/functions/send-birthday-messages/index.ts` (retry helper, sms_log failure write, idempotency change).
- No schema changes needed; `sms_log` already has `status`, `error_message`, `sms_type`, `channel`, `tenant_id`, `member_id`.
- The failure row is inserted with the service-role client, bypassing RLS, matching how `send-sms` writes its own rows.
