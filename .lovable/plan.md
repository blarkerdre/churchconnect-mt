# Recorder and timestamps: Church Attendance + Bible School Applications

Mirror the Training Report / Home Cell changes in two more places.

## Church Attendance

### Record / Edit form
- New "Recorded by" dropdown at the top, listing all members of the church, defaulting to the signed-in person.
- The dropdown is only visible to admins; everyone else keeps recording silently as themselves.
- Saved on both new reports and edits, so a later correction keeps the right recorder.

### Reports table
- New "Recorded by" column with the person's name.
- New "Recorded on" column showing creation date and time in the standard format `14 Aug 2026, 14:13`, with a small "edited <date, time>" hint underneath when the record was changed later.
- Both columns hidden on narrow screens; on mobile the recorder and timestamp appear as small text under the service date.

### Exports
- CSV gains "Recorded by" and "Recorded on" columns.
- Printed report gains the same two columns.

## Bible School Applications

### Applications table
- "Submitted" column shows full date and time instead of date only.
- New "Reviewed by" column showing who approved or declined, with the review date and time underneath.
- New column hidden on narrow screens; shown in the detail dialog on all sizes.

### Detail dialog
- Header line keeps the submitted timestamp and adds "Reviewed by <name> · <date, time>" once a decision has been made.

### Export
- CSV gains "Reviewed by" and "Reviewed on" columns and switches the submitted value to the same readable date/time format.

## Technical notes

- `church_attendance_reports.recorded_by`, `created_at`, `updated_at` already exist and are returned by the `select("*")` query; `wofbi_applications.reviewed_by` / `reviewed_at` are already written on approve/decline. No schema changes.
- Church Attendance: fetch tenant-scoped `members` (id, name, user_id) for the dropdown options, keep a `user_id -> name` map for table/CSV/print rendering, and include the current user if absent. Gate dropdown visibility on `isAdmin` from `useAuth`.
- `recorded_by` is currently set only on insert; include it in the update payload too, defaulting to `user?.id`.
- Resolve reviewer names in the applications tab from the existing tenant profiles/members lookup already used there.
- Use the shared `formatDateTime` helper in `src/lib/utils.js` everywhere so formats stay identical.
- Files touched: `src/pages/ChurchAttendance.jsx`, `src/components/exams/WoFBIApplicationsTab.jsx`.
