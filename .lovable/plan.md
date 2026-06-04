## What I found

- No `unit_tasks` or `unit_task_assignments` rows currently exist in the database, so task creation is not reaching a successful save.
- The table grants and current access policies are present, but the UI currently performs task creation in multiple client-side steps:
  1. create `unit_tasks`
  2. create `unit_task_assignments`
  3. trigger notifications
- That makes the flow fragile: if any client-side insert, permission check, assignment row, or notification call fails, the user can experience “Create Task” doing nothing or rolling back.
- The notification function has no recent logs, which strongly suggests it is not being reached after the button click.

## Plan

1. **Move creation into one backend action**
   - Add a dedicated `create-unit-task` backend function.
   - It will validate the signed-in user is tenant owner/admin/super admin or a leader for the selected unit.
   - It will create the task and assignment rows in one controlled flow using backend privileges after validation.
   - It will return clear errors if tenant, permission, title, unit, or selected members are invalid.

2. **Update the dialog submit handler**
   - Replace the two direct table inserts with a single function call.
   - Keep the visible loading state on the Create Task button.
   - Show a success toast when the task is created.
   - Show a clear error toast if creation fails.

3. **Ensure members are notified**
   - After successful task creation, trigger the existing `notify-unit-task-assignment` flow from the backend side.
   - Keep notification failure best-effort so a task is not lost if email/SMS/push has an issue.
   - In-app notifications will be created for selected members who have login accounts; email/SMS can still use member contact details where available.

4. **Add safe diagnostics**
   - Log key backend steps: request received, permission result, task created, assignments created, notification triggered.
   - Do not log private message content or secrets.

5. **Verify**
   - Deploy the backend functions.
   - Test creating a task as a tenant owner/admin.
   - Confirm rows appear in `unit_tasks` and `unit_task_assignments`.
   - Confirm notification function logs appear after task creation.