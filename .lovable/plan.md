# Home Cell: recorder name + timestamps

Mirror the Training Report change in Home Cell attendance: let the person recording a meeting pick who reported it, and show when each record was created/edited.

## What changes

### Record / Edit Attendance form
- New "Reported by" dropdown at the top of the form.
- Options: the selected centre's Home Cell leader and host, plus other Home Cell leaders in the church; defaults to the person currently signed in (added to the list if not already there).
- Saved on both new reports and edits, so a later correction keeps the right reporter.

### Attendance table
- New "Reported by" column showing the person's name.
- New "Recorded on" column with the creation date and time in the standard format `14 Aug 2026, 14:13`; if the record was edited afterwards, a small "edited <date, time>" hint appears under it.
- Both columns hidden on narrow screens; on mobile the reporter and timestamp appear as small text under the date.

### Exports
- CSV download gains "Reported by" and "Recorded on" columns.
- Printed report gains a "Reported by" column and the recorded date/time.

## Technical notes

- `wsf_attendance_reports.reported_by` (uuid), `created_at` and `updated_at` already exist and are already returned by the `select("*")` query — no schema change.
- Build the reporter option list from `members` scoped to the current tenant (ids referenced by `wsf_centres.leader_id` / `host_member_id`, already fetched as `centreMembers` in `WSFManagement.jsx`), mapped to their `user_id`, plus the signed-in user. Keep an id → name map for table, CSV and print rendering.
- `reported_by` is currently set only on insert and never shown; include it in the payload from the dialog for both insert and update, defaulting to `user?.id`.
- Use the existing `formatDateTime` helper in `src/lib/utils.js`.
- Files touched: `src/components/wsf/WSFAttendanceTab.jsx`, `src/components/wsf/WSFAttendanceFormDialog.jsx`.
