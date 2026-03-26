

## Fix: Restrict Invitation Token Visibility to Tenant-Scoped Admins

### Problem

The `tenant_invitations` SELECT policy uses `is_admin(auth.uid())` which returns TRUE for any tenant owner/admin across ALL tenants (via `tenant_memberships` check without tenant scoping). This means an admin of Tenant A can read invitation tokens for Tenant B.

### Current Policy (inferred)

```sql
USING (is_admin(auth.uid()) OR is_tenant_admin(auth.uid(), tenant_id))
```

The `is_admin()` function checks `user_roles` for admin/super_admin OR `tenant_memberships` for owner/admin — without scoping to a specific tenant. So any tenant admin passes this check for all rows.

### Fix

Replace the SELECT policy to use only tenant-scoped checks:

```sql
DROP POLICY IF EXISTS "Admins can view tenant invitations" ON public.tenant_invitations;

CREATE POLICY "Admins can view tenant invitations"
ON public.tenant_invitations
FOR SELECT
TO authenticated
USING (
  is_tenant_admin(auth.uid(), tenant_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);
```

Also review and tighten the ALL/INSERT/UPDATE/DELETE policies on this table if they use `is_admin()` similarly.

### Technical Details

**Migration SQL:**
- Drop existing overly broad policies on `tenant_invitations`
- Recreate with `is_tenant_admin(auth.uid(), tenant_id)` for tenant-scoped access
- Add `has_role(auth.uid(), 'super_admin')` for legitimate global admin access
- Apply same pattern to ALL/UPDATE/DELETE policies

### Impact

- Tenant admins can only see invitations for their own tenant
- Super admins retain global visibility (legitimate use case for platform management)
- No application code changes needed — `TenantUsersDialog.jsx` already filters by `tenant_id`

### Files Changed

- **One database migration** — replace RLS policies on `tenant_invitations`

