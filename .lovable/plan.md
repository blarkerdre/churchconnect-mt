

## Fix: Backfill Orphaned Email Logs + Improve Auth-Email-Hook Tenant Resolution

### Problem
1. **8 signup email logs have NULL tenant_id** — the auth-email-hook resolves tenant from `tenant_memberships`, but at signup time the user doesn't have a membership row yet (it's created by the `handle_new_user` trigger after the auth hook fires)
2. **Future signup emails will have the same problem** — the hook needs a fallback resolution strategy
3. **SystemLogs tenant scoping** — already uses `scopeQuery` on all panels, but the AuditLogsPanel's profiles query uses `scopeQuery` on profiles which may filter out profiles from other contexts; also need to verify all components are properly tenant-scoped

### Fix

#### 1. Database migration — backfill + improve future resolution

**Backfill:** Update the 8 orphaned `email_send_log` rows by joining to `tenant_memberships` via the recipient email → profiles → user_id → tenant_memberships chain:

```sql
UPDATE public.email_send_log el
SET tenant_id = tm.tenant_id
FROM public.profiles p
JOIN public.tenant_memberships tm ON tm.user_id = p.user_id
WHERE el.tenant_id IS NULL
  AND el.template_name = 'signup'
  AND lower(el.recipient_email) = lower(p.email)
  AND tm.tenant_id IS NOT NULL;
```

#### 2. Update auth-email-hook — resolve tenant from user metadata

When `tenant_memberships` lookup fails (signup case), fall back to resolving tenant from the user's `tenant_slug` metadata (passed during signup via `raw_user_meta_data`). The hook can:
1. Try `tenant_memberships` first (existing logic — works for recovery, magic link, etc.)
2. If NULL, check `payload.data.user_meta_data?.tenant_slug` and look up the tenant by slug
3. If still NULL, try matching via `profiles.email`

This ensures signup emails get the correct tenant_id even before the membership row exists.

#### 3. Redeploy auth-email-hook

Required for changes to take effect.

### Files changed
1. **1 database migration** — backfill 8 orphaned rows
2. **`supabase/functions/auth-email-hook/index.ts`** — add fallback tenant resolution from user metadata
3. **Redeploy** auth-email-hook edge function

