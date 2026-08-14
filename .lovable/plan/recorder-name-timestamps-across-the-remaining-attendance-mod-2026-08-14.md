# Recorder name + timestamps across the remaining attendance modules

Extend today's pattern (admin-only "Recorded by" picker, plus recorded/edited timestamps on screen and in exports) to the attendance and report modules that don't have it yet.

## Modules covered

1. Church Unit meeting attendance (sessions list)
2. Teens Church attendance sessions
3. Preteens Church attendance sessions
4. Bible School attendance sessions
5. Inventory inspections

Children's Church check-ins are left alone — they already stamp the worker who dropped off and picked up each child automatically.

## What changes in each module

### "Recorded by" picker
- Shown only to admins, in the create/edit session dialog (and in the inspection form for Inventory).
- Lists church members who have an app account; defaults to the person signed in.
- Non-admins see no picker and are recorded as themselves automatically.

### Session / record lists
- New "Recorded by" column showing the person's name.
- New "Recorded on" column with date and time in the standard `14 Aug 2026, 14:13` format, with a small "edited …" hint underneath when the record was changed later.
- Both columns hidden on narrow screens; on mobile the name and time appear as small text under the session date.

### Exports
- CSV downloads and printed reports for these modules gain "Recorded by" and "Recorded on" columns.

## Technical notes

- No schema changes. `attendance_sessions`, `teen_attendance_sessions`, `preteen_attendance_sessions` and `wofbi_attendance_sessions` all already have `created_by`, `created_at`, `updated_at`; `inventory_inspections` already has `inspected_by` and `inspected_at`. These are currently set to `user.id` on insert and never displayed.
- Reuse the existing approach from `ChurchAttendance.jsx`: a tenant-scoped `members` query mapped to `user_id` → name for both the dropdown options and a name-resolution map for historical rows, plus the shared `formatDateTime` helper in `src/lib/utils.js`.
- Include `created_by` / `inspected_by` in update payloads too, so a later correction can reassign the recorder (admin only); all writes keep their existing `.eq("tenant_id", tenantId)` guards.
- Files touched: `src/pages/Attendance.jsx`, `src/components/attendance/SessionFormDialog.jsx`, `src/pages/TeensAttendance.jsx`, `src/pages/PreteensAttendance.jsx`, `src/components/exams/WoFBIAttendanceTab.jsx`, `src/components/inventory/InspectionDialog.jsx`, `src/components/inventory/InspectionHistoryDialog.jsx`.
