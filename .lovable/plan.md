

## Fix: Allow Admins to Manage Non-Admin Roles in user_roles

### Problem
The `user_roles` table has a `FOR ALL` policy restricted to `super_admin` only. When a regular admin tries to grant `unit_leader` or `wsf_leader`, the INSERT is rejected by RLS.

### Current Policies on user_roles
- **"Super admins can manage roles"** — `FOR ALL`, requires `has_role(auth.uid(), 'super_admin')` — this is the only write policy (besides invitation self-insert)
- **"Admins can view all roles"** — `SELECT` only
- **"Users can view own roles"** — `SELECT` only

### Solution
Add a new RLS policy that allows tenant admins to INSERT and DELETE `unit_leader` and `wsf_leader` roles within their tenant. Admins should NOT be able to assign `admin` or `super_admin` roles.

### Database Migration
```sql
-- Allow admins to insert non-admin roles within their tenant
CREATE POLICY "Admins can manage leader roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  is_admin(auth.uid(), tenant_id)
  AND role IN ('unit_leader', 'wsf_leader')
)
WITH CHECK (
  is_admin(auth.uid(), tenant_id)
  AND role IN ('unit_leader', 'wsf_leader')
);
```

This restricts admins to only granting/revoking `unit_leader` and `wsf_leader` — they cannot escalate to `admin` or `super_admin`.

### Files Changed
- **New migration** — adds the RLS policy above
- No code changes needed — the UI already correctly limits which roles admins can toggle

