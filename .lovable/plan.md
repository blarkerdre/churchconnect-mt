Consolidate the six new demographic totals into a single summary card on the Home Cell Attendance report.

## Changes

**File:** `src/components/wsf/WSFAttendanceTab.jsx`

1. Remove the six standalone stat cards (Male, Female, Adults, Children, First Timers, Testimonies) from the admin summary grid.
2. Revert the grid back to `grid-cols-2 sm:grid-cols-5` for the original five operational cards (Cell Centres, Meetings Held, Meetings Not Held, Avg Attendance, Total Attendance).
3. Add one new "Attendance Breakdown" card directly below the stats grid. Inside it, render the six totals as a compact 3-column (2 on mobile) grid of label/value pairs with small icons:
   - Male, Female, Adults, Children, First Timers, Testimonies
4. Card uses existing `Card`/`CardHeader`/`CardContent` components and semantic tokens; values pulled from already-computed `summaryStats` fields (`totalMale`, `totalFemale`, `totalAdults`, `totalChildren`, `totalFirstTimers`, `totalTestimonies`).
5. Only renders for admins (inside the existing `{isAdmin && ...}` block) and when `filteredReports.length > 0`.
