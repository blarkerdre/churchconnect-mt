## Fix: Birthday messages not sending (Tola Rotibi + anyone else with a birthday today)

### Root cause
The hourly cron `send-birthday-messages-hourly` calls `send-birthday-messages` with the Vault-stored `email_queue_service_role_key`. That stored value no longer matches the project's current `SUPABASE_SERVICE_ROLE_KEY`, so every invocation returns 403 before any tenant is processed. No log row is written, no email/in-app/SMS goes out.

### Steps

1. **Refresh the Vault service-role key**
   - Run `email_domain--setup_email_infra` (idempotent). It re-syncs the Vault secret `email_queue_service_role_key` to the current service-role key so the cron's bearer token matches again.

2. **Add a clear warning log on bearer mismatch in `send-birthday-messages`**
   - Before returning 403, `console.warn(...)` with: function name, that the incoming bearer did not match `SUPABASE_SERVICE_ROLE_KEY`, length of received token (not the value), and a hint to re-run email infra setup.
   - This makes future silent 403s visible in function logs instead of only in `net._http_response`.
   - Redeploy `send-birthday-messages`.

3. **Manually resend today's birthday messages for WCI Cardiff**
   - Invoke `send-birthday-messages` with `{ tenant_id: <WCI Cardiff> }` using the (now-correct) service-role bearer.
   - This greets Tola Rotibi and anyone else whose DOB is 16 June, across in-app + email + SMS per tenant settings.

4. **Verify**
   - Check `net._http_response` for the next hourly tick → expect 200.
   - Check `birthday_message_log` → expect `sent` rows for Tola on enabled channels (email + in_app; SMS skipped — no phone).
   - Confirm Tola's inbox / in-app bell shows the greeting.

### Out of scope
No changes to message templates, scheduling cadence, channel logic, or any other cron.