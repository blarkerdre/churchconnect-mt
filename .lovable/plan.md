
## Fix tenant delete so the UI reflects the real backend state

### What I confirmed
- The backend delete is succeeding: the latest `archive-tenant` request returned `200` with `{"success":true,"action":"deleted"}`.
- So the remaining problem is now **frontend state**, not the delete function itself.

### Root cause
`TenantAdmin.jsx` still falls back to `tenantMemberships/currentTenant` when `queryTenants` is empty.

That works as a rescue path when the tenants query has not loaded yet, but it breaks after deleting the **last matching tenant**:
- delete succeeds in the backend
- `["tenants-admin"]` refetches and correctly returns `[]`
- the fallback runs because `queryTenants.length === 0`
- stale tenant context data gets re-added
- Archive tab still shows `1`

Also, invalidating `["tenant-memberships"]` does not currently refresh `TenantContext`, because that state is not powered by React Query.

### Implementation plan

1. **Make `TenantAdmin` trust an empty tenants query once it has finished loading**
   - In `src/pages/TenantAdmin.jsx`, change the `tenants` `useMemo` logic:
     - if the tenants query has loaded successfully, use `queryTenants` as the source of truth even when it is empty
     - only use fallback tenants while the query is still loading, or possibly when the query errors
   - This prevents deleted tenants from being resurrected in the UI.

2. **Tighten post-delete refresh behavior**
   - Keep invalidating:
     - `["tenants-admin"]`
     - `["tenant-stats"]`
     - `["tenant-analytics"]`
   - Remove reliance on `["tenant-memberships"]` unless a real query is added for it, because right now it does not refresh the context-backed memberships.

3. **Add an explicit tenant-context refresh path**
   - In `src/contexts/TenantContext.jsx`, add a small `refreshTenantContext()` helper that re-fetches memberships and re-selects the current tenant.
   - Expose it from `useTenant()`.
   - Call it after successful delete/archive/restore in `TenantAdmin.jsx`.
   - If the deleted tenant was the currently selected tenant, clear it or switch to the next valid tenant.

4. **Guard against stale current tenant after deletion**
   - In `TenantContext.jsx`, when memberships are refreshed, ensure `currentTenant` is reset if its tenant no longer exists in the refreshed memberships.
   - This avoids stale tenant state leaking into other parts of the app after lifecycle actions.

### Files to update
- `src/pages/TenantAdmin.jsx`
  - trust loaded `queryTenants` even when empty
  - call tenant-context refresh after lifecycle mutations
  - keep only meaningful query invalidations
- `src/contexts/TenantContext.jsx`
  - add `refreshTenantContext()`
  - clear/reselect `currentTenant` when a tenant disappears

### Expected result
After permanent delete:
- the backend deletes the tenant
- the tenants query refetches
- an empty result stays empty
- stale fallback data is not re-added
- Archive tab count drops correctly
- tenant context no longer points at a deleted tenant

### Technical note
Use logic like this in `TenantAdmin.jsx`:

```js
const tenants = useMemo(() => {
  if (!isLoading && !tenantsError) return queryTenants;

  const map = new Map();
  tenantMemberships?.forEach(m => {
    if (m.tenants) map.set(m.tenants.id, m.tenants);
  });
  if (currentTenant) map.set(currentTenant.id, currentTenant);

  return [...map.values()];
}, [isLoading, tenantsError, queryTenants, tenantMemberships, currentTenant]);
```

That is the key fix: fallback only while the main query is unresolved, not after it has successfully returned zero rows.

No database changes are needed.
