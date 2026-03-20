

## Fix Welcome Email Delivery and Add Email Monitoring Dashboard

### Problem
The `send-welcome-email` Edge Function is never executing successfully — zero `welcome-registration` entries exist in the email logs. The `public-register` function calls it via fire-and-forget (`fetch().catch()`) which silently swallows all errors. Auth signup emails work fine (6 sent successfully).

### Plan

#### 1. Redeploy send-welcome-email Edge Function
The function code looks correct but may not be deployed. Force a redeployment to ensure it's live and accessible.

#### 2. Add error visibility to public-register
Update the `triggerWelcomeEmail` function in `public-register` to log the response status so failures aren't silent. Keep it non-blocking but add `console.error` on non-200 responses.

Redeploy `public-register` as well.

#### 3. Add Email Monitoring Dashboard (admin-only)
Create a new page at `/email-dashboard` accessible only to admins, showing:

- **Summary stat cards**: Total emails, Sent, Failed, Pending (deduplicated by `message_id`)
- **Time range filter**: Last 24h, 7 days, 30 days
- **Template filter**: Filter by `template_name` (e.g. `signup`, `welcome-registration`)
- **Status filter**: All, Sent, Failed, DLQ
- **Email log table**: One row per unique email (deduplicated), columns: Template, Recipient, Status (color-coded badge), Timestamp, Error message. Paginated at 50 rows, sorted by newest first.

This page will query `email_send_log` using the admin's authenticated session. Since the table currently only has `service_role` RLS policies, a new SELECT policy will be added for admin users.

#### 4. Database migration
Add an RLS policy allowing admins to read `email_send_log`:
```sql
CREATE POLICY "Admins can view email logs"
ON public.email_send_log FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));
```

#### 5. Wire up navigation
Add an "Email Logs" link in the admin sidebar/settings area.

### Files involved
- `supabase/functions/public-register/index.ts` — better error logging
- `supabase/functions/send-welcome-email/index.ts` — redeployment
- `src/pages/EmailDashboard.jsx` — new page
- `src/App.jsx` — add route
- `src/components/AppLayout.jsx` — add nav link
- New migration — RLS policy for admin email log access

