## Goal
Ensure unit tasks are visible only to members who belong to that unit (plus leaders/admins who manage them). Today, only assigned members, unit leaders, admins, and super admins can see tasks — regular members of the same unit can't see them, and there's no "unit membership" gate.

## Changes

### 1. New SECURITY DEFINER helper
Add `public.user_is_unit_member(_user_id uuid, _unit_name text, _tenant_id uuid) returns boolean` that checks `public.members` for a row where `user_id = _user_id`, `tenant_id = _tenant_id`, and `church_unit` (comma-separated) contains `_unit_name` (case-insensitive, trimmed). Grant EXECUTE to `authenticated` and `service_role` only.

### 2. Update RLS on `public.unit_tasks`
Replace `unit_tasks_select` so a row is visible when ANY of:
- `has_role(auth.uid(), 'super_admin')`
- `is_admin(auth.uid(), tenant_id)`
- `user_leads_unit(auth.uid(), unit_name, tenant_id)`
- `user_is_unit_member(auth.uid(), unit_name, tenant_id)` ← new
- `is_reports_officer(auth.uid(), tenant_id)` (keep existing separate policy)

Drop the `is_assigned_unit_task` branch — membership now covers visibility, and assignees are members of the unit by definition for normal flows.

### 3. Update RLS on `public.unit_task_assignments`
Update `uta_select` so a row is visible when:
- `user_id = auth.uid()` (own assignment), OR
- `can_manage_unit_task(auth.uid(), task_id, tenant_id)` (leaders/admins), OR
- the parent task's `unit_name` matches a unit the user is a member of via `user_is_unit_member` (lookup task → unit_name, tenant_id inside a new tiny SECURITY DEFINER helper `task_is_in_user_unit(_user_id, _task_id, _tenant_id)` to avoid recursion).

### 4. Frontend (`src/pages/UnitTasks.jsx`)
Members who aren't leaders currently never hit the "Leading" tab. No UI change is required for visibility — RLS will let the "My Tasks" tab show only their own assignments, while leaders continue to see the unit-wide view. No code changes needed unless we also want a read-only "Unit board" tab for plain members (not in scope unless requested).

## Out of scope
- Adding a new tab for non-leader members to browse all unit tasks.
- Changing who can create / update / delete tasks (still leaders + admins).