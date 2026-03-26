

## WSF Attendance Tenant Isolation Audit

### Issues Found

**1. Reports query missing explicit tenant scope (line 59-63)**
The `wsf_attendance_reports` SELECT query filters only by `centre_id` using `.in()`, not by `tenant_id`. While the centres list passed as a prop is tenant-scoped (from `WSFManagement.jsx`), the query itself has no direct tenant filter. If RLS is permissive or centre IDs overlap, this could leak cross-tenant data.

**Fix:** Add `tenantId` to the query key and use `scopeQuery` to add `.eq("tenant_id", tenantId)`.

**2. Reports query key missing tenantId (line 56)**
`queryKey: ["wsf-attendance-reports", visibleCentreIds]` — no tenant in the cache key. If a user switches tenants, stale data from the previous tenant could be served from cache.

**Fix:** Change to `["wsf-attendance-reports", tenantId, visibleCentreIds]`.

**3. Update mutation missing tenant scope (line 73)**
`supabase.from("wsf_attendance_reports").update(payload).eq("id", editing.id)` — no tenant filter on the update. Relies solely on RLS.

**Fix:** Add `.eq("tenant_id", tenantId)` to the update query for defense-in-depth.

**4. Delete mutation missing tenant scope (line 88-91)**
Same issue — deletes by `id` only, no tenant filter.

**Fix:** Add `.eq("tenant_id", tenantId)` to the delete query.

### Changes

**File: `src/components/wsf/WSFAttendanceTab.jsx`**

1. Reports query (line 56-66): Add `tenantId` to query key, wrap query with `scopeQuery`
2. Update mutation (line 73): Add `.eq("tenant_id", tenantId)` 
3. Delete mutation (line 88): Add `.eq("tenant_id", tenantId)`

### No database or migration changes needed
RLS policies already exist on `wsf_attendance_reports` — these code changes add defense-in-depth at the application layer.

