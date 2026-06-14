## Goal
Allow unit leaders (in addition to admins/super admins) to **edit task details** and **reassign members** on tasks for units they lead, directly from the Unit Task detail panel.

## Current state
- Unit leaders can already **create** tasks (`create-unit-task` edge function checks `user_leads_unit`) and **cancel/delete** tasks (RLS + `canManage` in `UnitTasks.jsx` already include `leaderUnits`).
- Database RLS on `unit_tasks` and `unit_task_assignments` already permits unit leaders to UPDATE/INSERT/DELETE — so **no migration or edge function is required**.
- What's missing: UI surfaces for editing the task and changing the assignee list.

## Changes

### 1. `src/components/unitTasks/UnitTaskFormDialog.jsx`
Make this dialog double as an editor:
- Accept an optional `task` prop. When present, prefill form fields, disable the **Unit** selector (changing unit would invalidate assignments), and submit via direct `supabase.from("unit_tasks").update(...)` scoped by `id` + `tenant_id` instead of calling `create-unit-task`.
- Title becomes "Edit Unit Task" when editing.
- Hide the assignees section in edit mode (managed separately, see #3) so the form stays focused on task fields.
- Audit log: emit `unit_task.updated` with the changed fields.

### 2. `src/pages/UnitTasks.jsx`
- Reuse `UnitTaskFormDialog` for editing by adding an `editing` state and passing it as `task`.
- Wire a new `onEdit` callback into `UnitTaskDetailPanel` that closes the panel and opens the form in edit mode.

### 3. `src/components/unitTasks/UnitTaskDetailPanel.jsx`
When `canManage` is true and `task.status === "Open"`:
- Add an **Edit** button in the footer that calls the new `onEdit(task)` prop.
- Add a **Reassign** control in the Assignees section:
  - "Add members" button opens a lightweight picker (same query as the form: members in `task.unit_name` for this tenant, excluding existing assignees). Selected members are inserted into `unit_task_assignments` (`tenant_id`, `task_id`, `member_id`, `user_id`, `status: "Pending"`). After insert, best-effort invoke `notify-unit-task-assignment` so new assignees get notified.
  - Each existing assignee row gets a small **Remove** button that deletes the assignment row (scoped by `id` + `tenant_id`). Skip the confirmation if the assignment is already `Pending`; confirm otherwise.
- Refetch assignments after each change; audit log `unit_task.reassigned` with added/removed counts.

## Out of scope
- No DB migration, no new edge function — existing RLS covers leader writes.
- No changes to `create-unit-task`, notifications infra, or the report dialog.
- No bulk reassign across multiple tasks.