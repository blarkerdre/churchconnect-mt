

## Fix: Signup, Login & Tenant Isolation — Comprehensive Audit

### Issues Found

#### 1. **CRITICAL: `user_roles` unique constraint breaks tenant isolation**
The `user_roles` table has `UNIQUE (user_id, role)` — missing `tenant_id`. This means:
- A user can only have one `member` role across ALL tenants
- The `ensureTenantAccess` upsert `onConflict: "user_id,role"` silently overwrites the tenant_id of an existing role when joining a second tenant
- This is a tenant isolation violation

**Fix**: Drop the existing constraint and create `UNIQUE (user_id, role, tenant_id)`. Update the `onConflict` in `ensureTenantAccess` accordingly.

#### 2. **`acceptPendingInvitations` fails silently due to RLS**
In `TenantContext.jsx`, the `acceptPendingInvitations` function inserts into `tenant_memberships` using the **anon/user client**. But RLS only allows super_admins and tenant_admins to insert — a new user has neither role, so the insert silently fails. The user never gets added to the tenant.

**Fix**: Add an RLS policy allowing authenticated users to insert their own `tenant_memberships` row when a matching pending invitation exists. Alternatively, move invitation acceptance to a server-side function.

#### 3. **`handle_new_user` trigger doesn't set `tenant_id` on profiles**
The trigger creates a profile with only `user_id`, `full_name`, and `email` — no `tenant_id`. This means profiles created via the trigger are invisible in tenant-scoped queries.

**Fix**: Update the trigger to attempt tenant resolution from pending invitations or pass through metadata.

#### 4. **Edge function `public-register` may still be running stale code**
Logs show only boot/shutdown — no request-level logs. The function needs redeployment to ensure the `tenant_slug` fallback is live.

---

### Plan

#### Migration 1: Fix `user_roles` unique constraint for multi-tenancy

```sql
-- Drop the old constraint that doesn't include tenant_id
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;

-- Add tenant-aware unique constraint
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_tenant_key 
  UNIQUE (user_id, role, tenant_id);
```

#### Migration 2: Allow invitation-based self-insert into `tenant_memberships`

```sql
-- Allow users to accept their own invitations by inserting into tenant_memberships
CREATE POLICY "Users can accept invitations for themselves"
ON public.tenant_memberships
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.tenant_invitations ti
    WHERE ti.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND ti.tenant_id = tenant_memberships.tenant_id
    AND ti.status = 'pending'
  )
);
```

Also allow users to update invitation status for their own email:
```sql
CREATE POLICY "Users can accept their own invitations"
ON public.tenant_invitations
FOR UPDATE
TO authenticated
USING (lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())))
WITH CHECK (lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())) AND status = 'accepted');
```

#### Migration 3: Update `handle_new_user` trigger to resolve tenant

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant_id uuid;
BEGIN
  -- Try to resolve tenant from a pending invitation
  SELECT tenant_id INTO _tenant_id
  FROM public.tenant_invitations
  WHERE lower(email) = lower(NEW.email)
    AND status = 'pending'
  LIMIT 1;

  INSERT INTO public.profiles (user_id, full_name, email, tenant_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    _tenant_id
  );
  RETURN NEW;
END;
$$;
```

#### Code change 1: Fix `ensureTenantAccess` in `public-register/index.ts`

Update the `onConflict` for `user_roles` to include `tenant_id`:
```ts
await supabase.from("user_roles").upsert(
  { user_id: userId, role: "member", tenant_id: tenantId },
  { onConflict: "user_id,role,tenant_id" }
);
```

#### Code change 2: Add `user_roles` insert to `acceptPendingInvitations` in `TenantContext.jsx`

After inserting `tenant_memberships`, also insert a `user_roles` row with role `member`:
```js
await supabase.from("user_roles").insert({
  user_id: userId,
  role: "member",
  tenant_id: inv.tenant_id,
});
```

#### Deployment: Redeploy `public-register` edge function

Ensure the latest code (tenant_slug fallback + fixed onConflict) is live.

#### Data repair: Fix orphaned profile

```sql
UPDATE public.profiles
SET tenant_id = (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = profiles.user_id LIMIT 1)
WHERE tenant_id IS NULL
AND EXISTS (SELECT 1 FROM public.tenant_memberships WHERE user_id = profiles.user_id);
```

---

### Files to change
- `supabase/functions/public-register/index.ts` — fix `onConflict` in `ensureTenantAccess`
- `src/contexts/TenantContext.jsx` — add `user_roles` insert in `acceptPendingInvitations`
- **3 database migrations** — constraint fix, RLS policies, trigger update
- **1 data repair** — fix orphaned profiles
- **Redeploy** `public-register` edge function

