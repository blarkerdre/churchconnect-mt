# Restrict today's "Recorded by / Reported by" dropdowns to admins

Three modules got a person-picker dropdown today. Only Church Attendance is already admin-only; make the other two match.

## What changes

### Training Report — "Recorded by"
- The dropdown only appears for admins.
- Non-admins record as themselves automatically; the value is still saved and still shown in the table, CSV and print.

### Home Cell attendance — "Reported by"
- The dropdown only appears for admins.
- Home Cell leaders and hosts recording a meeting are saved as the reporter automatically, with no picker shown.

### Church Attendance — "Recorded by"
- Already admin-only; no change.

## Technical notes

- `src/pages/TrainingReports.jsx`: wrap the "Recorded by" `Select` block (around line 550) in `isAdmin &&`; `recorded_by` keeps defaulting to `user.id` in form state so saves are unaffected.
- `src/components/wsf/WSFAttendanceTab.jsx`: pass a new `canChooseReporter={isAdmin}` prop to `WSFAttendanceFormDialog`.
- `src/components/wsf/WSFAttendanceFormDialog.jsx`: render the reporter `Select` only when `canChooseReporter` is true; `form.reported_by` still defaults to `currentUserId` and is still sent on insert and update.
- Display columns, CSV and print output are unchanged for all roles.
