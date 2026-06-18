## Goal

Limit the "Show all tenant records" toggle (and the all-tenant children browser) in My Family to super admins only. Tenant admins/owners will no longer see it.

## Change

**`src/pages/MyFamily.jsx`**
- Import `useTenant` from `@/contexts/TenantContext` and pull `isSuperAdmin`.
- Replace `const canSeeAll = isAdmin;` with `const canSeeAll = isSuperAdmin;`.
- Leave the rest of the toggle/query/empty-state logic untouched — they already key off `canSeeAll`.

## Out of scope

- No DB/RLS changes. Backend access for admins and CC workers is unchanged; this is purely a UI gate on the My Family toggle.
- No changes to GuardianManager, DelegationDialog, or check-in/pickup flows.
