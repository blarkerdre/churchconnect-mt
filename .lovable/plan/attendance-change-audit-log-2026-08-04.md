# Attendance change audit log

Record every attendance change — who made it, when, and exactly which fields changed — across all attendance modules, viewable in System Logs → Audit.

## What gets audited

Attendance records and their sessions in every module:

- Bible School attendance (records and sessions)
- Unit / Church attendance (records and sessions)
- Teens attendance (records and sessions)
- Preteens attendance (records and sessions)
- Home Cell attendance

For each change the log stores the actor (the signed-in user, or "System" for automated/QR check-ins), the timestamp, the action (created / updated / deleted), the person affected, the session it belongs to, and a field-by-field before → after list (status, time in, time out, duration, punctuality rating and note, session title, date, status, notes).

## Where it appears

System Logs → Audit. Entries read in plain English, for example:

"Jane Smith updated attendance for John Doe — status: absent → present, time in: — → 10:04"

The existing Audit tab already supports actor names, date range, entity filter, expandable before/after diffs and CSV export, so attendance entries slot straight in with a new "Attendance" entity filter option.

## Technical notes

- Database-level auditing via a shared `AFTER INSERT/UPDATE/DELETE` trigger function `public.audit_attendance_change()` attached to: `wofbi_attendance_records`, `wofbi_attendance_sessions`, `attendance_records`, `attendance_sessions`, `teen_attendance_records`, `teen_attendance_sessions`, `preteen_attendance_records`, `preteen_attendance_sessions`, `wsf_attendance`. Triggers guarantee coverage regardless of which UI path or RPC performed the change — no attendance tables currently have audit triggers.
- The function is `SECURITY DEFINER` with `SET search_path = public`, writes one `audit_log` row per change with `tenant_id` taken from the row, `user_id = auth.uid()` (null for service-role/cron writes, which the UI renders as "System"), `entity_type` set to the table name, `entity_id` set to the row id.
- `details` payload: `{ module, action, member_name, session_title, before: {...}, after: {...} }`, with `before`/`after` limited to the meaningful columns so the existing `diffFields` helper renders a clean change list. Names are resolved by looking up the member/registration row inside the function.
- Updates that change nothing meaningful (identical payloads) are skipped so the log stays readable.
- Client changes are limited to `src/pages/SystemLogs.jsx`: add attendance actions to `ACTION_LABELS` (e.g. `attendance_record_update` → "updated attendance"), add field-name prettifying for attendance columns, and an icon/colour for the attendance action group.
- No changes to attendance write paths in the app; existing RLS is unaffected.
