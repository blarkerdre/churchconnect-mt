

## Fix: Follow-up Unit Member Not Receiving Email/SMS for First Timer & New Convert

### Root cause (two issues)

1. **Vault secrets were stale/missing** — The `auto_create_followup` trigger reads `supabase_url` and `email_queue_service_role_key` from the vault to call `notify-followup-assignment`. These secrets were stale, so `net.http_post` was silently failing (confirmed: zero edge function logs, zero email/SMS log entries despite followups being created successfully).

   **Status: Already fixed** — I just refreshed the vault secrets by running the email infrastructure setup.

2. **Wrong sender domain in edge function** — `notify-followup-assignment/index.ts` line 123 uses `notify.churchmanagementsuite.org` as the sender domain, but the verified domain is `notify.app.churchmanagementsuite.org`. Even after the vault fix, emails would be rejected by the email API.

   Same issue exists in two other edge functions:
   - `send-welcome-email/index.ts` — uses `notify.churchmanagementsuite.org`
   - `send-course-registration-email/index.ts` — uses `notify.churchmanagementsuite.org`

### Fix

**1. `supabase/functions/notify-followup-assignment/index.ts`**
- Change line 123: `notify.churchmanagementsuite.org` → `notify.app.churchmanagementsuite.org`
- Update `fromAddress` to use `app.churchmanagementsuite.org` for the From header (consistent with other functions)

**2. `supabase/functions/send-welcome-email/index.ts`**
- Change `SENDER_DOMAIN` to `notify.app.churchmanagementsuite.org`
- Change `FROM_DOMAIN` and `ROOT_DOMAIN` to `app.churchmanagementsuite.org`

**3. `supabase/functions/send-course-registration-email/index.ts`**
- Same domain fixes as above

**4. Deploy all 4 edge functions**
- `notify-followup-assignment`
- `send-welcome-email`
- `send-course-registration-email`
- `process-email-queue` (refreshed by infrastructure setup)

### Files changed
- `supabase/functions/notify-followup-assignment/index.ts` — fix sender domain
- `supabase/functions/send-welcome-email/index.ts` — fix sender domain
- `supabase/functions/send-course-registration-email/index.ts` — fix sender domain
- Deploy 4 edge functions

