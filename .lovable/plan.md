## Problem

Admins cannot create new unit tasks. RLS on `unit_tasks` and `unit_task_assignments` currently only allows:
- `super_admin` (app role)
- `tenant_memberships.role in ('owner','admin')`
- unit leaders for their unit

Users who are admins via the app-level `user_roles` table (role = `'admin'`) — but not also a tenant_memberships owner/admin — fail the `WITH CHECK` and get blocked on insert. This is the same bridge pattern used elsewhere in the project (per the Role Bridging memory).

## Fix

Update RLS policies on `unit_tasks` and `unit_task_assignments` so an app-level admin is treated the same as a tenant admin/owner. No UI changes needed — `UnitTasks.jsx` and `UnitTaskFormDialog.jsx` already correctly gate creation to admins and unit leaders, and pass the right `unit_name` + members.

### Migration

For each of these 8 policies, add `has_role(auth.uid(), 'admin'::app_role)` as an additional OR branch:

- `unit_tasks_insert` (WITH CHECK) — keep the `created_by = auth.uid()` guard
- `unit_tasks_select`, `unit_tasks_update`, `unit_tasks_delete`
- `uta_insert` (WITH CHECK)
- `uta_select`, `uta_update`, `uta_delete`

The existing unit-leader and tenant-membership branches remain untouched, so unit leaders continue to only see/manage their own units' tasks.

## Out of scope

- No changes to the form UI, member filtering, or the unit dropdown — those already enforce the rule that admins see all units and leaders see only theirs.
- No changes to assignment status flows.
