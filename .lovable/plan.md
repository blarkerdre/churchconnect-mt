## Goal
Give Teens Church unit leaders (and admins) a **cumulative attendance report** across all teen attendance sessions, with filters — not just the per-session report that exists today.

## Findings
- `src/pages/TeensAttendance.jsx` currently exposes a per-session `ReportDialog` (lines 243–328) reached from the "Report" button on each session row.
- RLS on `teen_attendance_records` / `teen_attendance_sessions` already lets leaders read all rows in their tenant.
- `useTeensUnitRole` already surfaces `isLeader`. Report actions are gated by `canManage = isAdmin || isLeader`.

## Change
Add a **Cumulative Report** entry point at the top of the Teens Attendance page (visible only when `canManage`) that opens a new dialog `CumulativeReportDialog`. Leave the existing per-session Report button in place.

### CumulativeReportDialog contents
Query `teen_attendance_records` joined to `teen_attendance_sessions` and `teens` for the current tenant, then aggregate by teen.

Filter bar:
- Date range (from / to) — defaults to last 90 days
- Session type (dropdown of distinct session titles / service types)
- Status (All / On time / Late / Missing check-out)
- Search by teen name

Two views inside the dialog:
1. **Summary by teen** (default): Name, Sessions attended, On-time %, Late count, Total hours, Missing check-outs.
2. **Detailed rows**: Date, Session, Teen, In, Out, Duration, Status, Source — respecting the same filters.

Actions: Export CSV (current view), Print.

### Files touched
- `src/pages/TeensAttendance.jsx` — new `CumulativeReportDialog` component + a "Cumulative report" button in the header, wired behind `canManage`.

## Out of scope
- No DB schema changes, no RLS changes, no edge functions.
- No changes to the existing per-session report.
- No push/email — this is a read-only in-app report.
