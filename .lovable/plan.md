Consolidate the five main operational stats into a single summary card, matching the Attendance Breakdown pattern.

## Changes

**File:** `src/components/wsf/WSFAttendanceTab.jsx`

1. Replace the `grid-cols-2 sm:grid-cols-5` block of five standalone stat cards with a single "Summary" card.
2. Inside the card, render the five stats (Cell Centres, Meetings Held, Meetings Not Held, Avg Attendance, Total Attendance) in a 2-column (mobile) / 5-column (sm+) grid of icon + label + value + sub items, using the same compact row style as the Attendance Breakdown card.
3. Keep semantic tokens, icons, and `summaryStats` values as-is. Card only renders inside the existing `{isAdmin && ...}` block.
4. The Attendance Breakdown card below it stays unchanged.
