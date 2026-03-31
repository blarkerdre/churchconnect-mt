

## Scope All Auth, Registration & Update Queries to Tenant

### Problem

Several queries and operations on key pages lack tenant scoping, causing data leakage across tenants:

1. **MyProfile.jsx — `wsf_centres` query** (line 169): fetches all active WSF centres globally, no `tenant_id` filter
2. **MyProfile.jsx — `DynamicExamButtons`** (lines 879-901): `exam_titles` and `exam_subjects` queries have no tenant scope — shows courses from all tenants
3. **MyProfile.jsx — `course_registrations` query** (line 890): no tenant filter
4. **MyProfile.jsx — `exam_attempts` query** (line 910): no tenant filter
5. **MyProfile.jsx — `attendance_records` query** (line 178): no tenant filter
6. **ResetPassword.jsx** (line 26): navigates to `/` after reset instead of tenant-prefixed URL

### Fix

**1. `src/pages/MyProfile.jsx`** — Add tenant scoping to all unscoped queries:
- `wsf_centres` query: add `.eq("tenant_id", tenantId)` and include `tenantId` in query key
- `DynamicExamButtons`: accept `tenantId` prop, scope `exam_titles`, `exam_subjects`, `course_registrations`, and `exam_attempts` by tenant
- `attendance_records` query: add `.eq("tenant_id", tenantId)` filter (via the session's tenant, or directly on the records if the column exists)
- Pass `tenantId` from the parent component down to `DynamicExamButtons`

**2. `src/pages/ResetPassword.jsx`** — After password reset, redirect to the tenant-prefixed dashboard if a tenant slug is available (query tenant membership), or fall back to `/`.

### Files changed
- `src/pages/MyProfile.jsx` — tenant-scope 5 unscoped queries + pass tenantId to DynamicExamButtons
- `src/pages/ResetPassword.jsx` — tenant-aware redirect after password update

