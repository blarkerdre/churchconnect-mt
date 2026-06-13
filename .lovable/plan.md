## Goal
Allow Home Cell leaders to record when a meeting was **not held at the home cell** (e.g. relocated to church or alternate venue), and add a filter in the Home Cell report to view only those records.

## Changes

### 1. Database — `wsf_attendance_reports`
Add a new column:
- `held_at_home_cell BOOLEAN NOT NULL DEFAULT true`

Migration only adds the column; existing rows default to `true`.

### 2. Attendance form — `src/components/wsf/WSFAttendanceFormDialog.jsx`
- Add a checkbox/switch "Meeting held at home cell venue" (default: checked).
- When unchecked, show a short helper note: "Mark this when the meeting was held elsewhere (e.g. main church)."
- Include `held_at_home_cell` in the saved payload.

### 3. Report tab — `src/components/wsf/WSFAttendanceTab.jsx`

**Filter bar**: add a new Select next to the centre filter:
- Options: `All venues` (default), `At home cell`, `Not at home cell`.
- Apply alongside existing centre + date filters.

**Summary stats**: add a "Off-venue" stat card showing the count of filtered reports where `held_at_home_cell === false`.

**Table**: add a "Venue" column showing a badge:
- `At cell` (default styling) or `Off-venue` (muted/outlined).

**CSV + print**: include a `Venue` column in both `downloadReport()` and `buildPrintRows()` output.

## Out of scope
- No changes to analytics page aggregates.
- No notifications or workflow changes.
- The existing "Meetings Not Held" stat (estimated missing weeks) is unchanged — this new field captures meetings that *did* happen but at a different venue.
