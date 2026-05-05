## Goal
Add four new fields to the Record Church Attendance breakdown: **Converts**, **First Timers**, **Testimonies**, and **Cars**.

## Database
New migration adding nullable integer columns to `church_attendance_reports` (default 0):
- `converts`
- `first_timers`
- `testimonies`
- `cars`

## UI changes (`src/pages/ChurchAttendance.jsx`)
1. **Form (`emptyForm` + Attendance Breakdown grid)** — add four numeric inputs alongside the existing Adult M/F, Children, Teens fields.
2. **Submit handler** — include the four new fields in the insert payload. Note: these are **not** added to `total_attendance` (Converts/First Timers are usually a subset of adults; Cars are vehicles, not people) to avoid double-counting.
3. **Summary cards** — extend the grid to show totals for the four new metrics (expand from 6 to up to 10 cards, responsive).
4. **Table** — add four new columns (Converts, First Timers, Testimonies, Cars) before Total.
5. **CSV export & Print rows** — include the four new columns in headers/rows.
6. **Chart** — leave chart focused on demographic breakdown (Adult M/F, Children, Teens) since the new metrics are different units; no change.

## Notes
- Existing rows will read `0` for the new columns thanks to defaults.
- No RLS changes needed.

Approve to implement.