# Service Roster (Grouped Unit Tasks by Service Type)

Adds a new "Service Roster" creation flow alongside the existing unit task dialog. In one window an admin/leader picks a service type from Settings, selects unit members, and gives each selected member their own task. All members in the roster receive ONE shared notification that lists every member and their assigned task.

## What we're building

1. **Service Types reused from Settings** — uses the existing `app_settings.service_types` list (Sunday Service, Midweek Service, etc.) — no new settings UI.
2. **Group wrapper around `unit_tasks`** — new `unit_task_groups` table. Each `unit_tasks` row optionally links to a group via `group_id`. Existing flow is unchanged.
3. **New "Service Roster" dialog (member-first grid)** — added beside the existing "New Task" button on `UnitTasks` page.
4. **One shared notification per roster** — every assignee receives a single in-app/email/SMS notification containing the full roster: who got what task, scoped to that single creation action.

## User-facing changes

- **Unit Tasks page**: a new "New Service Roster" button next to "New Task".
- **Service Roster dialog** (member-first grid):
  - Step 1: pick a **Service Type** (dropdown from Settings → Services), a **Service Date**, a **Unit**, and an optional roster title.
  - Step 2: multi-select members from that unit.
  - Step 3: for each selected member, a row appears with inputs for: Task title (required), optional description, optional due date. Defaults can be bulk-applied.
  - Submit creates the group + one `unit_tasks` row per member, all linked to the group, then triggers ONE notification batch.
- **Tasks list grouping**: rosters appear collapsed as a single card "Sunday Service — 15 Jun 2026 (5 members)"; expanding shows each member's task. Existing single tasks render as before.
- **Notification content** (in-app/email/SMS) for every assignee:
  > "[Service Type] Roster — [Service Date]
  > You've been assigned: **[your task]**
  > Team:
  > • Member A — Welcome
  > • Member B — Worship lead
  > • Member C — Communion
  > …"

## Technical details

### 1. Database migration

New table `public.unit_task_groups`:
- `id`, `tenant_id`, `unit_id`, `service_type` (text, validated against `app_settings.service_types` in the create function), `service_date` (date), `title` (text, optional), `created_by`, `created_at`, `updated_at`.
- GRANTs: `authenticated` (SELECT/INSERT/UPDATE/DELETE), `service_role` ALL.
- RLS: same-tenant SELECT for any tenant member; INSERT/UPDATE restricted to tenant admins, unit leaders of `unit_id`, and Church Office members (mirrors `unit_tasks` policies).

Alter `public.unit_tasks`:
- Add nullable `group_id uuid REFERENCES public.unit_task_groups(id) ON DELETE CASCADE`.
- Add nullable `service_type text` and `service_date date` (denormalised for fast list queries / per-task display).
- Index on `(tenant_id, group_id)`.

No changes to `unit_task_assignments`.

### 2. Edge function: `create-service-roster` (new)

Input: `{ tenant_id, unit_id, service_type, service_date, title?, assignments: [{ member_id, title, description?, due_date? }] }`.
- Validates service_type against `app_settings.service_types`.
- Validates caller is tenant admin / unit leader / Church Office unit member.
- Inserts a `unit_task_groups` row.
- Inserts N `unit_tasks` rows (one per assignment) with `group_id` set + `service_type` + `service_date`.
- Inserts matching `unit_task_assignments` rows (one assignee per task).
- Returns `{ group_id, task_ids[], assignment_ids[] }`.
- Invokes new `notify-service-roster` with those IDs.

### 3. Edge function: `notify-service-roster` (new)

Input: `{ group_id }`.
- Loads group + all linked `unit_tasks` joined to their assignee `members` (name, email, phone, push tokens, comm prefs).
- Builds ONE shared roster body listing every "Member — Task".
- For each assignee, personalises the lead line ("You've been assigned: X") and delivers via the same in-app/email/SMS/push channels currently used by `notify-unit-task-assignment` (re-uses its delivery helpers).
- Per-recipient unsubscribe handling preserved; only content is shared.

The previous "co-assignees on the same task" plan is dropped — this new flow replaces that intent.

### 4. Frontend

- `src/components/unitTasks/ServiceRosterDialog.jsx` (new): member-first grid as described.
  - Fetches service types from `app_settings` (key `service_types`), units the caller can manage, and unit members.
  - On submit, calls `supabase.functions.invoke("create-service-roster", …)`.
- `src/pages/UnitTasks.jsx`:
  - Add "New Service Roster" button beside "New Task".
  - In the task list, group rows by `group_id` when present; show a roster header card with service type + date + member count, collapsible to reveal member tasks. Ungrouped tasks render as today.
- `src/components/unitTasks/UnitTaskDetailPanel.jsx`: when the opened task has a `group_id`, show a "Service Roster" section listing all sibling tasks (member + title) with links.

### 5. Out of scope

- No changes to acknowledgement / completion / comment flows.
- No edits to the existing "New Task" dialog or `notify-unit-task-assignment`.
- No per-member daily digest.
- No changes to Settings UI (service types already configurable there).

## Implementation order

1. Migration: `unit_task_groups` + alter `unit_tasks`.
2. Edge functions: `create-service-roster`, `notify-service-roster`.
3. Frontend: `ServiceRosterDialog`, button on `UnitTasks` page, grouped list rendering, detail-panel sibling list.
