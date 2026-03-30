

## Fix: "permission denied for table users" on tenant_invitations

### Root cause
Two RLS policies reference `auth.users` directly via subquery, which the `authenticated` Postgres role cannot SELECT from:

1. **"Users can view own pending invitations"** on `tenant_invitations` — line: `SELECT email FROM auth.users WHERE id = auth.uid()`
2. **"Users can self-insert role via invitation"** on `user_roles` — same subquery pattern

### Fix
One database migration that drops and recreates both policies using `auth.email()` (a built-in function that doesn't require table access):

```sql
-- Fix tenant_invitations SELECT policy
DROP POLICY IF EXISTS "Users can view own pending invitations" ON public.tenant_invitations;
CREATE POLICY "Users can view own pending invitations"
ON public.tenant_invitations
FOR SELECT TO authenticated
USING (lower(email) = lower(auth.email()));

-- Fix user_roles INSERT policy
DROP POLICY IF EXISTS "Users can self-insert role via invitation" ON public.user_roles;
CREATE POLICY "Users can self-insert role via invitation"
ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.tenant_invitations ti
    WHERE lower(ti.email) = lower(auth.email())
    AND ti.tenant_id = user_roles.tenant_id
    AND ti.status = 'pending'
  )
);
```

### Files changed
- One new database migration (SQL above)

No frontend changes needed.

