## Plan

1. **Fix My Family visibility**
   - Keep the page tenant-scoped.
   - Show every child linked to the signed-in parent in the current tenant:
     - primary guardian children
     - co-parent/guardian links where the relationship is `Parent`
   - Surface query errors instead of silently returning an empty list.

2. **Fix Children Church record rendering**
   - Keep Children Church tenant-scoped, but make each panel reliably load all records for the active tenant:
     - drop-off family search
     - active pickup/check-in list
     - report table
   - Add clear empty/error states so “no records” is distinguishable from an access/query failure.

3. **Harden backend access rules**
   - Update row-level access so Children Church workers, tenant admins, and reports officers can read the tenant’s children/check-in records they need.
   - Keep parents limited to their own children and co-parent links only.
   - Preserve explicit `tenant_id` checks in every query and access rule.

4. **Verify tenant data alignment**
   - Check existing children, guardians, members, and check-ins across tenants.
   - Confirm records belong to the expected tenant and that worker/admin access is not blocked by role/unit lookup logic.

## Technical notes

- Existing database records are split across two tenants, so the app should render records for the **currently selected tenant**, not all tenants globally.
- `children`, `child_guardians`, and `child_checkins` already have table grants; the likely issue is row-level visibility and/or role detection for the current tenant.
- I will avoid making child data publicly readable and will not remove tenant isolation.