

## Fix: Cannot Switch to Newly Created Tenants

### Root cause

When creating a tenant from the Tenant Admin page, the `tenant_memberships` insert (line 166-170 of `TenantAdmin.jsx`) uses the **anon Supabase client**, which is subject to RLS. Since the user doesn't yet have access to the newly created tenant, the insert fails silently. Additionally, no `user_roles` entry is created for the new tenant.

Result: Southampton and Croydon tenants exist but have **zero memberships and zero roles** — the creator is locked out.

### Fix

**1. `src/pages/TenantAdmin.jsx`** — After creating the tenant, call the `register-tenant` edge function or a new lightweight edge function to create the membership and roles with the service role key (bypassing RLS). Alternatively, create both `tenant_memberships` and `user_roles` rows via an RPC or edge function that uses the service role.

Simplest approach: use an edge function call instead of direct client insert for the membership + roles:

```js
// Replace lines 166-170 with:
await supabase.functions.invoke("admin-create-user", ...) 
// OR create the membership via a new RPC
```

Actually, the simplest fix is to add error handling and use the existing `register-tenant` flow, but since the tenant is already created inline, the best fix is:

- Move tenant creation to use the `register-tenant` edge function (which already handles membership + roles + profile + welcome email with service role)
- OR add an RPC function `create_tenant_membership` with `SECURITY DEFINER` that creates both the membership and user_roles entry

Recommended approach (least disruptive):

a. Create a new database function `create_tenant_owner(p_tenant_id uuid, p_user_id uuid)` with `SECURITY DEFINER` that inserts into both `tenant_memberships` and `user_roles`.

b. Update `TenantAdmin.jsx` `createMutation` to call this RPC after tenant creation.

c. After successful creation, call `refreshTenantContext()` so the new tenant appears in the switcher immediately.

**2. Database migration** — 
- Create the `create_tenant_owner` RPC
- Backfill: insert missing memberships and roles for Southampton and Croydon for the creator user

**3. `src/pages/TenantAdmin.jsx`** —
- Call `refreshTenantContext()` after tenant creation so the switcher updates
- Add error handling on the membership insert

### Technical details

New RPC function:
```sql
CREATE OR REPLACE FUNCTION public.create_tenant_owner(p_tenant_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO tenant_memberships (tenant_id, user_id, role)
  VALUES (p_tenant_id, p_user_id, 'owner')
  ON CONFLICT (tenant_id, user_id) DO NOTHING;
  
  INSERT INTO user_roles (user_id, role, tenant_id)
  VALUES (p_user_id, 'admin', p_tenant_id)
  ON CONFLICT DO NOTHING;
END;
$$;
```

Backfill for existing orphaned tenants:
```sql
INSERT INTO tenant_memberships (tenant_id, user_id, role)
VALUES 
  ('871818c5-0364-427a-87fd-d399dda06f2f', '6483c76f-3ce3-4f14-b0af-0c8a98ebb484', 'owner'),
  ('a8608b0b-9b0c-46d8-b145-92647660ad7f', '6483c76f-3ce3-4f14-b0af-0c8a98ebb484', 'owner')
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role, tenant_id)
VALUES
  ('6483c76f-3ce3-4f14-b0af-0c8a98ebb484', 'admin', '871818c5-0364-427a-87fd-d399dda06f2f'),
  ('6483c76f-3ce3-4f14-b0af-0c8a98ebb484', 'admin', 'a8608b0b-9b0c-46d8-b145-92647660ad7f')
ON CONFLICT DO NOTHING;
```

### Files changed
- 1 new migration — `create_tenant_owner` RPC + backfill Southampton/Croydon memberships
- `src/pages/TenantAdmin.jsx` — use RPC for membership creation + call `refreshTenantContext()`

