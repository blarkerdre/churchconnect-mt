Add six aggregated totals to the Home Cell Attendance report summary, respecting the existing centre + date-range filters.

## Changes

**File:** `src/components/wsf/WSFAttendanceTab.jsx`

1. Extend `summaryStats` (around line 123) to also compute:
   - `totalMale` = sum of `r.male`
   - `totalFemale` = sum of `r.female`
   - `totalAdults` = `totalMale + totalFemale`
   - `totalChildren` = sum of `r.children`
   - `totalFirstTimers` = sum of `r.first_timers`
   - `totalTestimonies` = sum of `r.testimonies`

2. Add six new stat cards to the admin summary grid (currently `grid-cols-2 sm:grid-cols-5`). Update grid to `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` so all 11 cards wrap cleanly on mobile (384px viewport) and desktop. New cards: Male, Female, Adults, Children, First Timers, Testimonies — using existing card style with appropriate lucide icons (e.g. `User`, `Users`, `Baby`, `UserPlus`, `MessageCircle`).

3. No DB, no schema, no logic changes elsewhere. Print and CSV downloads already include these per-row; only the summary cards are gaining totals.
