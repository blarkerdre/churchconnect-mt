

## Fix: Incorrect User Count & Missing Invite Email

### Issue 1: User count is wrong in Tenant Admin

**Root cause**: The `tenant_memberships` table's RLS policies only allow SELECT for users who are admin/owner of that specific tenant (`is_tenant_admin(auth.uid(), tenant_id)`). A super_admin viewing the Tenant Admin dashboard gets filtered counts — they can only see membership rows for tenants where they personally are admin/owner.

**Fix**: Add a SELECT policy on `tenant_memberships` allowing super_admins to view all rows:

```sql
CREATE POLICY "Super admins can view all tenant memberships"
ON public.tenant_memberships
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));
```

### Issue 2: No email sent for blarkerdre@yahoo.com invite

**Root cause**: `blarkerdre@yahoo.com` already has a `profiles` row, so `invite-to-tenant` takes the **auto-add** path (lines 52-86) — it creates a `tenant_memberships` row and a notification, but **never sends an email**. This is by design, but the admin expects a notification email.

**Fix**: In `supabase/functions/invite-to-tenant/index.ts`, after auto-adding an existing user, send a notification email via `send-transactional-email` using a new template or the existing `tenant-invitation` template with adjusted messaging. The simplest approach: send the same invitation email but with a different message indicating they've been added (not invited to sign up).

Alternatively, use a simpler approach — invoke `send-transactional-email` with the `tenant-invitation` template in the auto-add path too, since the email already has the tenant name and a link. The user just clicks through to their existing account.

**Changes to `invite-to-tenant/index.ts`** (auto-add path, after line 82):
- Fetch tenant details (name, slug)
- Send notification email via `send-transactional-email` with `tenant-invitation` template
- Log the email send result

### Files to change
1. **1 database migration** — add super_admin SELECT policy on `tenant_memberships`
2. **`supabase/functions/invite-to-tenant/index.ts`** — send email in auto-add path
3. **Redeploy** `invite-to-tenant`

