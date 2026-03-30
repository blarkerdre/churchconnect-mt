

## Fix: Archive Tab Still Shows 1 After Delete

### Root Cause
The `tenants` list in `TenantAdmin.jsx` merges data from three sources (lines 108-122):
1. `queryTenants` — direct DB query (invalidated correctly after delete)
2. `tenantMemberships` — from TenantContext (NOT invalidated after delete)
3. `currentTenant` — from TenantContext (NOT invalidated after delete)

After a permanent delete, the DB query returns the correct list, but the deleted tenant still appears via `tenantMemberships` or `currentTenant` cached in TenantContext. The merged list re-adds the deleted tenant, so the Archive tab count stays at 1.

### Fix
In `src/pages/TenantAdmin.jsx`, update the `archiveMutation.onSuccess` handler to also invalidate the tenant memberships query and force a TenantContext refresh:

1. Add `queryClient.invalidateQueries({ queryKey: ["tenant-analytics"] })` to clear analytics cache
2. For the **delete** action specifically, also invalidate memberships so the merge logic doesn't re-add the deleted tenant:
   - `queryClient.invalidateQueries({ queryKey: ["tenant-memberships"] })` (if used)
   - Or filter out the deleted tenant from the merge in `useMemo` by checking if it still exists in `queryTenants`

The cleanest fix: change the merge logic to only add from `tenantMemberships`/`currentTenant` if the tenant ID exists in `queryTenants`, OR if `queryTenants` is empty (the fallback case). This way, once the DB query confirms the tenant is gone, it won't be re-added.

### Files changed
- **`src/pages/TenantAdmin.jsx`** — update the `useMemo` merge logic to not re-add tenants that are absent from the DB query result (when the query has returned data), and add `tenant-analytics` to the invalidation list in `onSuccess`

### Technical detail
```js
// Current (broken): always merges from all 3 sources
// Fixed: only merge fallback sources when queryTenants is empty
const tenants = useMemo(() => {
  const map = new Map();
  queryTenants.forEach(t => map.set(t.id, t));
  // Only use fallback sources when direct query returned empty
  if (queryTenants.length === 0) {
    tenantMemberships?.forEach(m => {
      if (m.tenants && !map.has(m.tenants.id)) map.set(m.tenants.id, m.tenants);
    });
    if (currentTenant && !map.has(currentTenant.id)) map.set(currentTenant.id, currentTenant);
  }
  return Array.from(map.values());
}, [queryTenants, tenantMemberships, currentTenant]);
```

No database changes needed.

