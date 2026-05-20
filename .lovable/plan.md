Two scoped UI changes in `src/components/wsf/WSFAttendanceTab.jsx`:

## 1. Show Summary + Attendance Breakdown to Home Cell leaders

Both summary cards are currently gated on `{isAdmin && ...}`. Change the gate to `{canAccess && ...}` (where `canAccess = isAdmin || isWsfLeader`). Because `availableCentres`, `visibleCentreIds`, and `filteredReports` are already scoped to `ledCentres` for non-admins, the totals automatically reflect only the leader's own cells.

- Update gate on Summary card (uses Cell Centres / Meetings Held / Not Held / Avg / Total Attendance).
- Update gate on Attendance Breakdown card (Male/Female/Adults/Children/First Timers/Testimonies).

## 2. Hide Delete action from Home Cell leaders

In the reports table actions cell, wrap the Delete `<Button>` in `{isAdmin && (...)}` so only admins see it. Edit button stays available to leaders (consistent with current behavior).
