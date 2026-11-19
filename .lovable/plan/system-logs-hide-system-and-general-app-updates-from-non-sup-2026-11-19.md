# System Logs: hide system and general app updates from non-super-admins

## What changes
- In **System Logs -> Audit**, entries made by **System** (automatic jobs, no person) and entries with no module (shown as **Other** / general app updates) are visible only to super admins.
- Church owners and admins still see all activity done by people in their church (Members, Attendance, Follow-ups, Settings, etc.).
- The **Other** option disappears from the module filter for non-super-admins, and counts/CSV downloads match what they can see.

## Technical details
- Database read rule on `audit_log`: non-super-admin readers only get rows where `user_id is not null` and `details->>'module'` is set; super admins unchanged.
- `SystemLogs.jsx` `AuditLogsPanel`: same filter client-side for non-super-admins (defence in depth), via `useAuth` roles.
- Verify by signing in as a church admin and confirming no System/Other rows appear.
