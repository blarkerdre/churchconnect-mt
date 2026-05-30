
# Unit Tasks

Let unit leaders assign tasks to members of the unit(s) they lead. Members can view, acknowledge, and comment on tasks assigned to them. Unit leaders get a report.

## Data model

Two new tenant-scoped tables in `public` (with GRANTs + RLS):

### `unit_tasks`
- `id`, `tenant_id`, `created_at`, `updated_at`
- `unit_name text not null` — the church unit the task belongs to
- `title text not null`, `description text`
- `due_date date`, `priority text default 'Medium'` (Low/Medium/High/Urgent)
- `status text default 'Open'` (Open/Completed/Cancelled) — leader-controlled overall lifecycle
- `created_by uuid not null` (leader's `auth.uid()`)

### `unit_task_assignments`
- `id`, `tenant_id`, `task_id` (fk → `unit_tasks` on delete cascade), `member_id` (fk → `members`)
- `user_id uuid` (resolved from `members.user_id` for fast RLS checks; nullable for members without a login)
- `status text default 'Pending'` (Pending/Acknowledged/Completed)
- `acknowledged_at timestamptz`, `completed_at timestamptz`
- `created_at`, `updated_at`
- Unique `(task_id, member_id)`

### `unit_task_comments`
- `id`, `tenant_id`, `task_id`, `assignment_id` (nullable — null = thread-wide leader note)
- `author_id uuid not null` (auth.uid())
- `body text not null`
- `created_at`

### Helper function
- SECURITY DEFINER `public.user_leads_unit(_user_id uuid, _unit_name text, _tenant_id uuid) returns boolean` — checks `unit_leader_assignments`. Used by RLS to avoid recursion.

## RLS

- `unit_tasks`
  - SELECT: tenant admins/owners, OR `user_leads_unit(auth.uid(), unit_name, tenant_id)`, OR user has an assignment row on the task (subquery on `unit_task_assignments`).
  - INSERT/UPDATE/DELETE: tenant admin/owner OR `user_leads_unit(...)`.
- `unit_task_assignments`
  - SELECT: tenant admin, leader of the parent task's unit, OR `user_id = auth.uid()`.
  - INSERT/DELETE: leader of the unit or tenant admin.
  - UPDATE: leader/admin (any field) OR assignee (`user_id = auth.uid()`) but only `status`, `acknowledged_at`, `completed_at`.
- `unit_task_comments`
  - SELECT: tenant admin, unit leader, OR assignee on the task.
  - INSERT: same set; `author_id = auth.uid()` enforced.
  - DELETE: author or unit leader/admin.

GRANTs for all three: `SELECT, INSERT, UPDATE, DELETE` to `authenticated`; `ALL` to `service_role`. No `anon`.

## UI

### New page `/t/:tenantSlug/unit-tasks` (`src/pages/UnitTasks.jsx`)
Accessible to anyone who is a unit leader OR has any task assigned to them. Two tabs:

1. **Leading** (visible when `leaderUnits.length > 0` or tenant admin)
   - Unit selector (driven by `leaderUnits`; tenant admins see all active units via `get_active_church_unit_names`).
   - "New Task" button → dialog: title, description, due date, priority, multi-select members (fetched from `members` filtered by `tenant_id` + `church_unit` contains selected unit; uses the same comma-list logic already used elsewhere). On save: insert `unit_tasks` row, then bulk insert `unit_task_assignments` rows with resolved `user_id`.
   - Task list with assignment progress (e.g. "3/8 acknowledged · 1 completed"), filters by status/priority/unit.
   - Click a task → detail panel with all assignees, their status badges, acknowledged/completed timestamps, and the full comment thread. Leader can edit/cancel the task, add comments, and mark individual assignments complete.

2. **My Tasks** (visible to any user with assignments)
   - Cards/list grouped by status (Pending → Acknowledged → Completed).
   - Each card shows title, unit, due date, priority, leader name, and buttons: **Acknowledge** (sets `status='Acknowledged'`, `acknowledged_at=now()`), **Mark Complete** (sets `status='Completed'`, `completed_at=now()`), and a **Comments** thread inline.

### Dashboard surface
- Add a compact "My Tasks" widget to `MemberDashboard.jsx` (count of pending + nearest due date, link to `/unit-tasks`).
- Add an "Assigned Tasks" tile to `WSFLeaderDashboard.jsx`/leader dashboards (open tasks for their units).
- Notification bell: emit a row in the existing notifications system when a task is assigned and when an assignee comments — reuse whatever pattern `notify-followup-assignment` follows. (Out of scope: push/email; only in-app bell for now.)

### Navigation
- Add a "Unit Tasks" entry in `AppLayout.jsx` sidebar, visible when `isUnitLeader || isTenantAdmin || hasAnyAssignment` (the last derived from a lightweight query at app load — simplest: just always show it for any authenticated member; the page itself handles empty-state).

## Reports

Inside `UnitTasks.jsx` Leading tab → "Report" button opens `UnitTaskReportDialog.jsx` (modeled on `FollowupReportDialog.jsx`):
- Filters: unit, date range (created/due/completed), status, priority, assignee.
- Group by: none / assignee / unit / status / priority.
- Summary tiles: total tasks, total assignments, acknowledged %, completed %, overdue count, avg days to complete.
- CSV download + `PrintReportButton`.

## Out of scope

- Email/SMS/WhatsApp delivery of tasks (in-app notifications only for now).
- Recurring/templated tasks.
- File attachments on tasks/comments.
- Cross-unit assignment (a task belongs to one unit; assignees must be members of that unit).
- Editing task assignees after creation beyond add/remove (no re-routing between members).

## Technical notes

- All queries use `useTenantQuery().scopeQuery` and explicit `.eq("tenant_id", tenantId)` per multi-tenancy guards memory.
- Resolving `member_id → user_id` at insert time avoids RLS lookups against `members` from inside the assignments RLS policy.
- The `user_leads_unit` helper handles comma-separated unit memberships by exact match on `unit_leader_assignments.unit_name` (one row per unit per leader — same convention as existing code).
- Comment thread uses a simple query keyed on `task_id` with realtime channel (`postgres_changes` on `unit_task_comments`) so leader and members see live updates without refresh.
- Audit logging via existing `logAudit` for create/update/cancel/complete actions.

## Files

- New migration: tables, helper function, RLS, GRANTs.
- New: `src/pages/UnitTasks.jsx`
- New: `src/components/unitTasks/UnitTaskFormDialog.jsx`
- New: `src/components/unitTasks/UnitTaskDetailPanel.jsx`
- New: `src/components/unitTasks/UnitTaskReportDialog.jsx`
- New: `src/components/unitTasks/MemberTaskCard.jsx`
- New: `src/components/dashboard/MyTasksWidget.jsx`
- Edited: `src/App.jsx` (route), `src/components/AppLayout.jsx` (nav), `src/components/dashboard/MemberDashboard.jsx`, `src/components/dashboard/WSFLeaderDashboard.jsx` (widgets).
