

## Root cause

`tenant_memberships.user_id` references `auth.users(id)`, NOT `profiles.user_id`. There is no FK between `tenant_memberships` and `profiles`, so PostgREST's embedded select `profiles(user_id, full_name, email)` cannot resolve the relationship — it returns `null` for the embedded object on every row, and in some cases the parent rows get dropped from the result entirely (depending on PostgREST version and hint inference).

DB confirms 5 / 83 / 4 / 1 memberships exist across the four tenants — the data is there, the query just can't join.

Secondary issue (already-known): `profiles` RLS for non-super-admins filters by the profile's own `tenant_id`, so a tenant admin viewing their own tenant should still see those profiles, but a super-admin viewing any tenant has the `Super admins can view all profiles` policy, so that's covered.

## Fix

Stop relying on the implicit FK relationship. Fetch memberships and profiles in two steps and merge in JS.

### Edit `src/components/tenants/TenantUsersDialog.jsx` (lines 33-45)

Replace the single embedded query with:

1. Query `tenant_memberships` alone, scoped by `tenant_id`.
2. Collect the `user_id`s.
3. Query `profiles` with `.in("user_id", userIds)`.
4. Merge profiles onto memberships in JS (`m.profile = profilesById[m.user_id]`).
5. Update render: change `m.profiles` reads to `m.profile` (or keep `profiles` key for minimal diff).

Pseudocode:
```js
const { data: memberships = [] } = useQuery({
  queryKey: ["tenant-users", tenant?.id],
  queryFn: async () => {
    const { data: rows, error } = await supabase
      .from("tenant_memberships")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    if (!rows?.length) return [];
    const userIds = rows.map(r => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", userIds);
    const byId = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));
    return rows.map(r => ({ ...r, profiles: byId[r.user_id] || null }));
  },
  enabled: !!tenant?.id && open,
});
```

The render code already handles `profiles` being null (`profile?.full_name || "Unknown"`), so no other changes needed.

## Why not add a FK?

Adding `tenant_memberships.user_id → profiles.user_id` would require `profiles.user_id` to be unique (it likely is, but adding a cross-table FK to a non-`auth` table for an auth-id column is fragile and breaks if a profile row is missing). Two-step fetch is safer and consistent with how other parts of this codebase (e.g. `WSFLeaderAssignments`) join across `profiles`.

## Files
**Edit**
- `src/components/tenants/TenantUsersDialog.jsx` — lines 33-45

## Out of scope
- Changing FK structure
- Changing RLS on `profiles` (super-admin policy already covers the tenant-admin dialog case)
- Auditing other dialogs (none observed using this same broken embed pattern for `tenant_memberships → profiles`)

