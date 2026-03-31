
Fix the notification authentication break so assigned follow-up unit members receive their direct alerts again.

1. Confirmed root cause
- The database trigger `auto_create_followup()` is running.
- It calls `notify-followup-assignment` with the vault secret `email_queue_service_role_key`.
- The edge function is rejecting that request with `401 {"error":"Invalid token"}`.
- Because of that, no `followup-assignment` rows are being created in either `email_send_log` or `sms_log`.

2. What I’ll change
- Refresh the backend email infrastructure so the stored internal service token is updated to the current one.
- This is the correct fix because the trigger and function contract already match; the stored secret is stale.

3. Why this matches your symptom
```text
member status changes / registration
  -> auto_create_followup trigger runs
  -> tries to call notify-followup-assignment
  -> edge function returns 401 Invalid token
  -> email not enqueued
  -> sms not sent
```

4. Validation after the fix
- Re-check recent internal HTTP responses to confirm the function is no longer returning 401
- Confirm new `followup-assignment` entries appear in:
  - `email_send_log`
  - `sms_log`
- Verify the assigned follow-up unit member receives only their own task notification

5. Technical details
- Current trigger code reads:
  - `supabase_url` from vault
  - `email_queue_service_role_key` from vault
- Current edge function auth accepts:
  - service role token, or
  - authenticated user JWT
- The failure is not the SMS/email send logic itself; it is the internal auth between the trigger and the function.

6. No UI changes needed
- This is a backend/infrastructure repair only.
- The Followups page and assignment flow do not need code changes for this specific issue.
