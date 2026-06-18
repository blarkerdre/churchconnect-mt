## Problem

`GuardianManager` lists authorised adults via:

```js
supabase.from("child_guardians")
  .select("*, members:member_id(id, first_name, last_name, email, phone)")
```

The embedded `members` join is evaluated under the caller's RLS. A regular parent can only see their own `members` row, so for every other guardian the embedded `members` object comes back as `null` and the row renders with no name or contact info.

## Fix

Add a tenant-scoped, security-definer RPC that returns the guardians of a child together with the linked member's name, email, phone, and relationship — bypassing the `members` RLS while still enforcing tenant access and the same visibility rules already used for `child_guardians`.

### Database

New function `public.list_child_guardians(_child_id uuid, _tenant_id uuid)`:

- `SECURITY DEFINER`, `STABLE`, `search_path = public`.
- Returns empty unless `user_has_tenant_access(_tenant_id)` AND one of: `is_admin`, `is_children_church_member`, `is_child_primary_guardian`, `is_child_co_parent` — same gate as the existing SELECT policy on `child_guardians`.
- Returns columns: `id` (guardian row id), `child_id`, `member_id`, `relationship`, `can_pickup`, `first_name`, `last_name`, `email`, `phone`.
- Filters `cg.tenant_id = _tenant_id AND cg.child_id = _child_id`.
- `REVOKE ... FROM PUBLIC, anon`; `GRANT EXECUTE ... TO authenticated`.

No changes to `members` or `child_guardians` RLS.

### Frontend

`src/pages/MyFamily.jsx` `GuardianManager`:

- Replace the `child-guardians` query that does `select("*, members:member_id(...)")` with `supabase.rpc("list_child_guardians", { _child_id: child.id, _tenant_id: tenantId })`.
- Update the render to read the flattened fields (`g.first_name`, `g.last_name`, `g.email`, `g.phone`) instead of `g.members?.first_name` etc.
- Keep the existing remove-guardian mutation and the `["child-guardians", child.id]` query key so `invalidateQueries` continues to refresh the list after add/remove.

Optionally apply the same RPC in `ChildrenChurch.jsx` where it reads the same embed for the "Authorised pickup adults" panel — same root cause, same fix, so leaders without admin role also see names.

## Validation

1. As Oluwa (regular parent), open Authorised adults for a child that already has guardians — names, emails, phones now appear.
2. As an admin, open the same dialog — names still appear (RPC works for admins too).
3. As a user from a different tenant, calling the RPC for that child returns no rows.
4. Add and remove a guardian — list refreshes via existing query invalidation.
