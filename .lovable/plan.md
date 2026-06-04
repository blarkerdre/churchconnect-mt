## Problem

1. After fixing the disabled "New Task" button, task creation may still silently fail (e.g. RLS rejection on `unit_task_assignments` for some payloads) without surfacing a clear error. There are 0 rows in `unit_tasks` today.
2. When a task is created, assigned unit members receive no notification at all (no in-app bell, no email, no SMS, no push).

## Fix

### A. Notify assigned members

Create a new Edge Function `notify-unit-task-assignment` modeled on `notify-pastoral-assignment` / `notify-followup-assignment`:

- Auth: accept service role or a logged-in admin / unit leader / super_admin.
- Input: `{ task_id, tenant_id }`.
- Loads the task + all `unit_task_assignments` for it, joins members for phone/email/first_name and profiles for full_name/email.
- For each assigned user with a `user_id`:
  - Insert an in-app row into `public.notifications` (`type: 'unit_task'`, `reference_id: task_id`, `reference_type: 'unit_task'`, `tenant_id`, title "New task in {unit_name}", message = task title).
  - Send branded email via `enqueue_email` (tenant sender name, same template style as pastoral) with task title, unit, due date, priority, description.
  - Send SMS via Twilio gateway if `sms_notifications_enabled` and phone valid (respect `checkSmsQuota`).
  - Send push via `send-push` function (best-effort, ignore failures) so PWA users get a push.
- Fire-and-forget: wrap each per-recipient send in try/catch so one bad recipient doesn't block others.
- Idempotency: use `unit-task-${task_id}-${user_id}` as email idempotency key.

### B. Wire it from the form

In `src/components/unitTasks/UnitTaskFormDialog.jsx`, after the assignments insert succeeds, invoke the new function:

```js
supabase.functions.invoke("notify-unit-task-assignment", {
  body: { task_id: task.id, tenant_id: tenantId },
}).catch((e) => console.warn("notify-unit-task-assignment failed", e));
```

Do not await — toast success immediately so the dialog closes promptly even if notification dispatch is slow.

### C. Surface creation failures

Currently `toast.error(err.message || "Failed to create task")` shows the raw RLS message which can be confusing. Improve by:

- Logging the full error to console for debugging (`console.error("Unit task create failed", err)`).
- If `tErr` mentions `row-level security`, show: "You don't have permission to create a task for this unit."
- If `aErr` fires after `task` insert, attempt to roll back by deleting the orphan `task.id` so retrying doesn't leave a half-created task.

### D. Audit log

Add a `logAudit` entry on successful task creation (`action: "unit_task.created"`, `entity: "unit_task"`, `entity_id: task.id`, includes unit_name + assignee count) for consistency with other tenant actions.

## Technical Details

- Files created:
  - `supabase/functions/notify-unit-task-assignment/index.ts`
- Files edited:
  - `src/components/unitTasks/UnitTaskFormDialog.jsx` — invoke notify function, improve error toasts, rollback orphan task, add audit log.
- Reuses: `_shared/sms-quota.ts`, `enqueue_email` RPC, `notifications` table, `send-push` function.
- No DB schema/migration changes required — `notifications` table already has all needed columns.
- No RLS changes needed; the Edge Function uses service role for writes.

## Out of scope

- No changes to task detail panel, report dialog, or assignment status flow.
- No new tables, columns, enums, or migrations.
- No tenant settings UI for per-tenant unit task notification toggles (uses existing global `sms_notifications_enabled`).
