## Why birthday messages aren't sending automatically

The hourly pg_cron job `send-birthday-messages-hourly` IS scheduled and active (runs at minute 0 every hour), but **every invocation is being rejected with HTTP 403** by the edge function.

### Root cause

The cron job currently calls the function with the **anon key** as the `Authorization: Bearer` token:

```
'Authorization', 'Bearer eyJhbGciOi...' (anon key)
```

But `supabase/functions/send-birthday-messages/index.ts` requires one of:
1. `bearer === serviceKey` (service role) — for cron, OR
2. A real user JWT belonging to a tenant admin — for the manual "Send wishes" button

The anon key matches neither, so the function returns `403 Forbidden` and exits before querying tenants/members. That's why:
- Manual "Send wishes" works (uses the admin's JWT).
- Automatic hourly runs silently do nothing (no tenants processed, no logs beyond boot/shutdown).

This is the same vault-secret pattern used by `process-email-queue`: cron must authenticate with the **service role key**, not the anon key.

### Fix

Reschedule the cron job to use the service role key from Supabase Vault instead of the hardcoded anon key. Use `supabase--insert` (not migration) since the SQL embeds secrets and shouldn't be replayed on remixes.

Steps:

1. **Ensure the service role key exists in Vault** under the name `email_queue_service_role_key` (already created by `setup_email_infra`). Reuse it — no new secret needed.

2. **Unschedule the broken job** and re-create it pulling the key from Vault:

   ```sql
   SELECT cron.unschedule('send-birthday-messages-hourly');

   SELECT cron.schedule(
     'send-birthday-messages-hourly',
     '0 * * * *',
     $$
     SELECT net.http_post(
       url := 'https://qfordhikmtgedfybktjg.supabase.co/functions/v1/send-birthday-messages',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key')
       ),
       body := '{}'::jsonb
     );
     $$
   );
   ```

3. **Verify** by querying `cron.job_run_details` after the next top-of-hour run, and check `birthday_message_log` for new `sent` rows on any tenant whose members have a birthday today.

### Out of scope

- No edge function code changes — its auth logic is correct.
- No template/UI/RLS changes.
- Not re-sending past missed birthdays (the function is idempotent per day, but historic dates won't be back-filled).

### Verification

After applying:
- `SELECT * FROM cron.job_run_details WHERE jobname = 'send-birthday-messages-hourly' ORDER BY start_time DESC LIMIT 3;` should show `status = succeeded` and HTTP 200.
- Edge function logs should show real invocations (not just boot/shutdown).
- On a day with a member birthday, `birthday_message_log` gains rows around the configured `send_hour_local` (default UTC hour 8).
