## Problem

In My Family → Authorised pickup adults, the search box queries `public.members` directly. RLS on `members` only lets regular users see their own row (admins/leaders/reports officers see more, but a normal parent like Oluwa Olu does not). So her search returns no results and she can't pick anyone to add — even though the new INSERT policy would now allow her to.

## Fix

Add a tenant-scoped, security-definer RPC for guardian-style member lookup and switch the GuardianManager search to use it. The RPC returns only the minimal fields needed to pick an adult (id, first/last name, email), is restricted to the caller's tenant, and requires a non-empty query.

### Database

New function `public.search_tenant_members_for_guardian(_tenant_id uuid, _q text)`:

- `SECURITY DEFINER`, `STABLE`, `search_path = public`.
- Verifies `user_has_tenant_access(_tenant_id)` for `auth.uid()`; returns empty otherwise.
- Requires `length(btrim(_q)) >= 2`.
- Returns rows from `members` in `_tenant_id` where first_name / last_name / email ILIKE `%q%`, ordered by name, `LIMIT 10`.
- Returned columns: `id`, `first_name`, `last_name`, `email`.
- `GRANT EXECUTE ... TO authenticated`; `REVOKE ... FROM anon, public`.

No changes to existing `members` RLS policies.

### Frontend

`src/pages/MyFamily.jsx` `GuardianManager`:

- Replace the direct `supabase.from("members").select(...).or(...)` search with `supabase.rpc("search_tenant_members_for_guardian", { _tenant_id: tenantId, _q: search })`.
- Keep the rest of the component (selection, insert, list, remove) unchanged.

## Validation

1. Sign in as Oluwa Olu (regular member, no admin/leader role). Open My Family → Authorised adults → type a name. Results from her tenant appear and adding succeeds.
2. Sign in as an admin in the same tenant. Search still works (RPC bypasses RLS, scoped by tenant).
3. Confirm a user from a different tenant cannot retrieve results for `_tenant_id` they don't belong to (RPC returns empty).
