

## Fix: Add Tenant Isolation to WSF Attendance Reports

### Problem

The `wsf_attendance_reports` SELECT policy `"Authenticated can view wsf reports"` uses `USING (true)`, allowing any authenticated user to read all WSF attendance data across all tenants.

### Fix

Drop and recreate the policy with `user_has_tenant_access(tenant_id)`:

```sql
DROP POLICY IF EXISTS "Authenticated can view wsf reports" ON public.wsf_attendance_reports;

CREATE POLICY "Authenticated can view wsf reports"
ON public.wsf_attendance_reports
FOR SELECT
TO authenticated
USING (user_has_tenant_access(tenant_id));
```

### Files Changed

- **One database migration** -- replace the overly broad SELECT policy

