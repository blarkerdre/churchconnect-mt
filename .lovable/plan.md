## Goal
Unit members (assignees) should not be able to comment on a unit task that is no longer Open (status `Completed` or `Cancelled`). Admins, tenant owners/super admins and the unit leader keep the ability to comment for record-keeping.

## Changes

### 1. Database rule (enforcement)
Replace the `utc_insert` policy on `unit_task_comments` so the assignee branch also requires the parent task to be `Open`:

- Assignee branch: assignment exists for `auth.uid()` **and** `unit_tasks.status = 'Open'`.
- Super admin / tenant owner+admin / unit leader branches stay unchanged.
- `author_id = auth.uid()` check retained.

### 2. UI (`src/components/unitTasks/UnitTaskDetailPanel.jsx`)
- Compute `canComment = canManage || (myAssignment && task.status === "Open")`.
- When the task is not Open and the user is only an assignee: hide the comment textarea and Post button, and show a short muted line such as "Commenting is closed for this task." Existing comments stay visible.

## Notes
Current data: 6 Open, 54 Completed, 6 Cancelled tasks — this only affects new comments; existing ones are untouched.
