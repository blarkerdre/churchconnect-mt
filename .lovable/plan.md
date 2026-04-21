

## Why "New row violates security policy" when granting admin

### Root cause
The `public.user_roles` table has only these write policies:

| Policy | Who | Which roles it lets them write |
|---|---|---|
| Admins can manage leader roles | tenant admin/owner | `unit_leader`, `wsf_leader` only |
| Super admins can manage roles | platform `super_admin` | any |

There is **no policy that lets a tenant owner/admin grant the `admin` role** (or revoke it). So when a tenant owner clicks the Admin toggle in User Management, the INSERT into `user_roles` is rejected by RLS — exactly the error you're seeing.

A second, smaller hole: the same policy also forbids a tenant admin from removing `member` rows (e.g. when fully deactivating a user), and forbids granting `wsf_leader` via paths that include other roles in a single statement.

### Fix — add a tenant-admin policy that allows tenant-scoped role management

One new `FOR ALL` policy on `public.user_roles`:

- **Who**: `is_admin(auth.uid(), tenant_id)` — tenant owners and admins for that tenant.
- **What roles they may write**: `admin`, `unit_leader`, `wsf_leader`, `member`.
- **What they may NOT write**: `super_admin` (still reserved for platform super admins).
- **Tenant guard**: `tenant_id` on the row must equal a tenant the caller administers (already enforced by `is_admin(uid, tenant_id)`).

```sql
-- Tenant admins/owners can grant or revoke tenant-scoped roles
-- (admin, unit_leader, wsf_leader, member). super_admin stays restricted
-- to the existing "Super admins can manage roles" policy.
CREATE POLICY "Tenant admins can manage tenant roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  public.is_admin(auth.uid(), tenant_id)
  AND role <> 'super_admin'::app_role
)
WITH CHECK (
  public.is_admin(auth.uid(), tenant_id)
  AND role <> 'super_admin'::app_role
  AND tenant_id IS NOT NULL
);
```

The existing "Admins can manage leader roles" policy becomes redundant once this is in place — drop it in the same migration to keep the policy list clean:

```sql
DROP POLICY IF EXISTS "Admins can manage leader roles" ON public.user_roles;
```

The two SELECT policies and the super-admin policy stay untouched.

### Why this is safe
- `is_admin(uid, tid)` only returns true for `tenant_memberships.role IN ('owner','admin')` for that exact tenant, or for platform super_admins. So a tenant owner of Cardiff cannot grant admin in another tenant.
- `role <> 'super_admin'` keeps platform-level escalation impossible — only existing super admins can mint a new super admin.
- `tenant_id IS NOT NULL` in `WITH CHECK` prevents creating an unscoped (global) role row by accident.
- No client code changes required — `UserManagement.jsx` already inserts `{ user_id, role, tenant_id }`.

### Files touched
- New migration: `supabase/migrations/<ts>_user_roles_tenant_admin_policy.sql` — the two SQL statements above.

### Verification
1. Sign in as a tenant owner (e.g. Adeniyi for Cardiff) → toggle Admin on a user in **User Management** → no error, badge appears, audit log row written.
2. Toggle Admin off → row removed cleanly.
3. As the same tenant owner, toggling `unit_leader` / `wsf_leader` still works (regression check).
4. As a tenant owner, attempt to insert `super_admin` via console → still rejected by RLS.
5. As a regular member, attempt to insert any role → still rejected.
6. As a tenant owner of tenant A, attempt to insert a role with `tenant_id` of tenant B → still rejected (`is_admin` returns false for the other tenant).

