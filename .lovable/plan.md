# Add Worker Name to Teens Attendance Report

The `teen_attendance_records` table already stores `checked_in_by` and `checked_out_by` (auth user IDs), but the Report and Cumulative Report don't surface them. This plan adds worker names to both.

## Changes (all in `src/pages/TeensAttendance.jsx`)

### 1. `ReportDialog` (single-session report)
- After fetching records, gather unique `checked_in_by` / `checked_out_by` user IDs and fetch `members` (`user_id, first_name, last_name`) for the current tenant to build a userId → name map.
- Add two columns to the on-screen table: **Signed in by**, **Signed out by**. Fallback to "—" when null; label "Self" when `source === 'self'` and the actor id equals the record's own teen self-enrolment (i.e. no worker).
- Add the same two columns to the CSV export (`downloadCsv`).

### 2. `CumulativeReportDialog`
- Extend the select to include `checked_in_by, checked_out_by`.
- Fetch the same tenant members map once per open, memoised.
- Add **Signed in by** / **Signed out by** columns to the Detailed view table and to the Detailed CSV export.
- Summary view remains per-teen (no worker column there).

## Technical notes
- Worker lookup uses `members` scoped to `tenant_id` with `.in("user_id", [...])`; no schema change needed.
- Self check-ins (`source = 'self'`) generally have no worker — display "Self" instead of a blank when both actor IDs are null.
- No backend/RLS changes; `members` is already readable to admins and unit leaders who can open these reports.
