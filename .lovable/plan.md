## Why "Ade Me" appears

`Ade Me` is a course registration in the **Demo Church (TEST)** tenant, enrolled on the "Basic Certificate Course" (a demo-tenant course). It is not a WCI Cardiff record.

It leaks onto the WCI Cardiff Bible School → Management → **Registrations** view because of stale state after tenant switching:

1. `src/pages/ExamManagement.jsx` keeps `selectedCourse` in local component state and only auto-selects a course when `!selectedCourse`. When you switch tenants, the previously selected demo-tenant course object stays in state, so WCI Cardiff visually appears to have that course selected.
2. `CourseRegistrationsView` (line 880) queries `course_registrations` filtered only by `course_id`, with no `tenant_id` guard. As a super-admin, RLS lets you read across tenants, so the demo registration (Ade Me) is returned even though the active tenant is WCI Cardiff.

Result: WCI Cardiff has 0 courses/registrations of its own, but the leftover demo course selection surfaces demo-tenant registrations.

## Fix

Two small, defensive changes in `src/pages/ExamManagement.jsx`:

1. **Reset course selection on tenant switch.** Clear `selectedCourse`, `selectedSubject`, `showResults`, and `showRegistrations` in a `useEffect` keyed on `tenantId`, so switching tenants forces re-selection from the current tenant's `examTitles`.
2. **Tenant-scope the registrations query in `CourseRegistrationsView`.** Add `.eq("tenant_id", tenantId)` to the `course_registrations` select (line 883–888) and include `tenantId` in the query key so cache is per-tenant. Same guard for the invalidations already keyed by `course.id`.

No schema, RLS, or backend changes needed. Purely frontend state hygiene + a defensive tenant filter.

## Out of scope
- No changes to RLS or the super-admin cross-tenant read policy.
- No changes to the Applications tab (already tenant-scoped via `scopeQuery`).
