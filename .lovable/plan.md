## Goal
Let admins edit an existing Bible School attendance session instead of only creating, closing/reopening, or deleting it.

## Where
`src/components/exams/WoFBIAttendanceTab.jsx` — the Bible School → Attendance tab. It is already gated to admins only (non-admins get an access message), and the `wofbi_attendance_sessions` table already has an admin-only write policy, so no database or policy changes are needed.

## What changes

1. **Edit button per session row**
   Add a pencil "Edit" action in the Actions column of the sessions table, next to Roster / Close-Reopen / Delete.

2. **Reuse the session dialog for edit mode**
   Turn the existing "New Attendance Session" dialog into a shared create/edit dialog:
   - Header becomes "Edit Attendance Session" and the primary button becomes "Save changes" when editing.
   - Fields pre-fill from the selected session.
   - Same validation: Title and Date required.

3. **Editable fields**
   - Title
   - Date
   - Notes
   - Status (Open / Closed) — added as a select in the dialog, so status can also be changed from the edit form as well as the existing quick Close/Reopen buttons.
   - Late-after time, subject, and auto-open/auto-close remain visible and editable too, since they are already part of the same form and are session metadata rather than audience scoping. (Say the word if you want those locked after creation.)

4. **Save behaviour**
   New `updateSession` mutation issuing an update on `wofbi_attendance_sessions` filtered by both `id` and `tenant_id`, then invalidating the session and record-count queries and showing a success toast. Switching status to Closed clears any scheduled open/close timestamps, matching what the existing Close action does.

## Notes
- Existing check-in records are untouched by an edit; changing the date only changes the session label/date shown in reports and CSV exports.
- No migration required.
