
Goal: make Tenant Admin reliably show LFC Cardiff in Live.

What I found:
- `src/pages/TenantAdmin.jsx` currently builds the table from only one query: `supabase.from("tenants").select("*")`.
- The page already has `tenantMemberships` from `useTenant()`, and that context loads `tenant_memberships` with nested `tenants(*)`.
- Live data already contains the tenant `LFC Cardiff` (`slug: lfc-cardiff`), and your Live account already has both `super_admin` and `owner` access to it.
- So this is not a missing-data problem; it is a visibility/reliability problem in the Tenant Admin UI path.

Plan:
1. Harden Tenant Admin tenant sourcing
   - Update `src/pages/TenantAdmin.jsx` to merge:
     - the main `tenants` query result
     - tenant records already available from `tenantMemberships`
     - the active `currentTenant` as a final fallback
   - Deduplicate by `tenant.id`
   - Prefer the full row from the direct `tenants` query when available

2. Use the merged tenant list everywhere on the page
   - Build `activeTenants`, `archivedTenants`, and tenant stats from the merged list instead of only the raw query result
   - Keep existing archive/switch/edit actions unchanged

3. Add a clearer empty/error state
   - If the direct tenants query fails or returns empty while membership-backed tenant data exists, show the fallback tenants instead of an empty table
   - Add a small status message explaining whether the page is using fallback membership data
   - Add a retry action for the tenants query so stale session/RLS issues are easier to recover from

4. Add context visibility for admins
   - Show a compact info row in Tenant Admin with:
     - current tenant name
     - current role(s)
     - environment label
   - This makes it obvious whether you are viewing Live vs Test and which tenant context is active

Files to update:
- `src/pages/TenantAdmin.jsx` — main fix
- Optionally `src/components/AppLayout.jsx` only if we want to improve tenant/environment visibility outside the page too

Technical details:
- No database migration is needed for this change
- No new backend function is needed
- The fix should rely on already-loaded `tenantMemberships` from `TenantProvider`, which currently fetches `tenant_memberships` with `tenants(*)`
- This avoids hiding a tenant just because the standalone `tenants` query is temporarily empty or blocked

Expected outcome:
- In Live, Tenant Admin will show `LFC Cardiff`
- In Test, Tenant Admin will still show the test tenant
- The page will be more resilient to session/RLS inconsistencies instead of appearing empty

Validation:
- Open Tenant Admin in Preview and confirm the test tenant still appears
- Open Tenant Admin on the published site and confirm `LFC Cardiff` appears
- Verify archive filter, edit dialog, stats, and “switch tenant” still work correctly with the merged tenant list
