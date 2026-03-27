
## Fix plan: restore self-service profile updates

### What I found
There are two issues behind “profile can not update”:

1. **Orphaned linked member records**
   - At least one linked member row still has `tenant_id = NULL`:
     - `members.id = 9991841c-e4d1-4098-bd83-a4c9863b21ed`
     - email `blarkerdre@yahoo.com`
   - The profile RPC can update that row, but the page then re-fetches via:
     ```js
     supabase.from("members").select(...).eq("user_id", user.id).maybeSingle()
     ```
   - RLS blocks the refetch because `user_has_tenant_access(NULL)` returns `false`.
   - Result: the save may succeed, but the UI falls back to “create/update profile” again, so it looks like nothing saved.

2. **Future orphan creation is still possible**
   - `CreateMemberProfile` only sends `tenant_id` if `tenantId` exists.
   - `public-register` still accepts authenticated profile creation with no resolved tenant, which can create more `members.tenant_id = NULL` rows.

### Implementation plan

#### 1. Repair existing bad data
Use a **data operation** (not a schema migration) to:
- find linked members where `user_id IS NOT NULL` and `tenant_id IS NULL`
- assign each one to the correct tenant
- create any missing `tenant_memberships`
- create any missing tenant-scoped `user_roles`

For the currently identified orphan, the repair will be:
```sql
UPDATE public.members
SET tenant_id = <correct-tenant-id>, updated_at = now()
WHERE id = '9991841c-e4d1-4098-bd83-a4c9863b21ed';

INSERT INTO public.tenant_memberships (user_id, tenant_id, role)
VALUES (<user_id>, <correct-tenant-id>, 'member')
ON CONFLICT (user_id, tenant_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role, tenant_id)
VALUES (<user_id>, 'member', <correct-tenant-id>)
ON CONFLICT (user_id, role, tenant_id) DO NOTHING;
```

#### 2. Harden `public-register`
Update `supabase/functions/public-register/index.ts` so authenticated self-service profile creation:
- **requires a tenant context**
- refuses to create/update a linked member with `tenant_id = NULL`
- returns a clear error if tenant resolution is missing

That prevents new orphaned member records.

#### 3. Harden `MyProfile`
Update `src/pages/MyProfile.jsx` so:
- the member lookup is **tenant-aware** when `tenantId` exists
- if no visible member exists but the user is authenticated, the page shows a clear tenant-assignment/setup error instead of silently behaving like a first-time profile
- successful save invalidates/refetches the tenant-scoped member query only

#### 4. Verify the full flow
After the fix, verify:
- existing orphaned account can edit and save profile
- profile stays visible after refresh
- new self-service profile creation always gets a tenant
- users cannot create/update records across tenants

## Technical details
```text
Current failure path:
linked member exists
-> tenant_id is NULL
-> RPC update may succeed
-> MyProfile re-fetch runs through RLS
-> user_has_tenant_access(NULL) = false
-> query returns null
-> UI shows CreateMemberProfile again
```

### Files to change
- `supabase/functions/public-register/index.ts`
- `src/pages/MyProfile.jsx`

### Data changes
- one targeted **data repair** for existing orphaned linked member rows
- no schema migration required unless you want an additional database-level validation later
