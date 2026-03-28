

## Fix: System Log Isolation and Missing Logs

### Problems Found

**1. `email_send_log` has no `tenant_id` — all 38 rows are NULL**
Edge functions that insert into `email_send_log` never include `tenant_id`:
- `send-welcome-email` — receives `tenant_id` in body but doesn't pass it to log inserts
- `send-transactional-email` — doesn't receive or log `tenant_id` at all
- `auth-email-hook` — no tenant context available
- `notify-pastoral-assignment`, `send-email-alert`, `issue-certificate` — same pattern

Because the SELECT RLS policy on `email_send_log` uses `is_admin(auth.uid(), tenant_id)`, and `is_admin(uid, NULL)` returns false, **tenant admins see zero email logs**. Only service_role reads bypass this.

**2. `audit_log` has 2 orphaned rows with NULL `tenant_id`**
These are invisible to tenant admins due to `user_has_tenant_access(NULL) = false`. Only super_admins can see them via the `has_role` bypass.

**3. `send-transactional-email` doesn't accept `tenant_id`**
It's the main email pipeline but has no way to associate logs with a tenant.

### Plan

#### 1. Fix `send-welcome-email` — pass `tenant_id` to all `email_send_log` inserts
The function already receives `tenant_id` from the request body. Add `tenant_id` to every `.insert()` call on `email_send_log` (5 insert sites).

#### 2. Fix `send-transactional-email` — accept and log `tenant_id`
- Parse optional `tenant_id` from the request body
- Pass it to all `email_send_log` insert calls (7+ insert sites)

#### 3. Fix `auth-email-hook` — resolve `tenant_id` from user metadata or invitation
- After identifying the user email, look up their `tenant_memberships` to get a tenant_id
- Pass it to `email_send_log` inserts

#### 4. Fix `notify-pastoral-assignment` — include `tenant_id` in log
- The function likely has access to the pastoral care record's `tenant_id`
- Pass it through to the email log insert

#### 5. Fix `send-email-alert` — include `tenant_id` in log
- Already has tenant context from the alert payload
- Pass it to the log insert

#### 6. Fix `issue-certificate` — include `tenant_id` in log
- Has tenant context from the certificate record
- Pass it to the log insert

#### 7. Data repair — backfill existing `email_send_log` rows
Attempt to resolve `tenant_id` for existing NULL rows by matching `recipient_email` to member/profile records:
```sql
UPDATE email_send_log esl
SET tenant_id = sub.tenant_id
FROM (
  SELECT DISTINCT ON (lower(m.email)) lower(m.email) as email, m.tenant_id
  FROM members m WHERE m.tenant_id IS NOT NULL
) sub
WHERE esl.tenant_id IS NULL AND lower(esl.recipient_email) = sub.email;
```

#### 8. Data repair — backfill audit_log NULL rows
```sql
UPDATE audit_log al
SET tenant_id = (
  SELECT tm.tenant_id FROM tenant_memberships tm 
  WHERE tm.user_id = al.user_id LIMIT 1
)
WHERE al.tenant_id IS NULL;
```

#### 9. Redeploy all affected edge functions

### Files to change
- `supabase/functions/send-welcome-email/index.ts`
- `supabase/functions/send-transactional-email/index.ts`
- `supabase/functions/auth-email-hook/index.ts`
- `supabase/functions/notify-pastoral-assignment/index.ts`
- `supabase/functions/send-email-alert/index.ts`
- `supabase/functions/issue-certificate/index.ts`
- 1 database migration for data repair

### Result
- Tenant admins will see email logs scoped to their church
- Existing logs will be backfilled with correct tenant_id
- Future logs will always include tenant_id
- Audit logs with NULL tenant_id will be fixed

