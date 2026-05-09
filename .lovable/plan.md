## Goal
Fix the metric inconsistencies and dead code identified in the audit of Dashboard, Unit Attendance, and Analytics.

## Changes

### 1. Align "Total Members" definition across pages
- **Dashboard (`Dashboard.jsx` / `get_dashboard_stats` consumer)**: keep "Total Members" = all members (current), and add a secondary "Active" line/sub-label so the number context is clear.
- **Analytics (`Analytics.jsx`)**: same — label the headline tile "Total Members" (all) with an "Active: N" sub-label.
- **Attendance (`Attendance.jsx`)**: rename the "Total" column/tile to "Active" (or "Eligible") so it no longer collides with Dashboard's "Total Members".

Net effect: the number labelled "Total Members" is the same everywhere; "Active" is shown as a clearly distinct, secondary metric.

### 2. Switch Growth Indices denominator to Active members
- **`src/components/dashboard/GrowthIndices.jsx`**: change `total = members.length` to `total = members.filter(m => m.status === "Active").length` (with a fallback of 1 to avoid divide-by-zero), and only count completions among Active members in the numerator too, so percentages reflect discipleship progress of the active congregation.
- Apply the identical change to the Analytics page's "Growth Milestones" / "Spiritual Development" section so Dashboard and Analytics stay in sync.
- Add a small caption under the section title: "% of Active members".

### 3. Delete dead analytics components
Remove (no imports anywhere in the app):
- `src/components/analytics/AttendanceTrends.jsx`
- `src/components/analytics/MemberConsistency.jsx`

Both reference non-existent columns (`attendance_records.status`, `session_date`, `member_name`) and would silently render zeros if re-imported.

### 4. Attendance Trend fallback to reported `total_count`
- **`src/pages/Analytics.jsx` "Attendance Trend"**: per session, use `MAX(digital_checkins_count, attendance_sessions.total_count)` as the per-session attendance figure, then aggregate by month/type.
- This makes Home Cell and demographic-only sessions (where leaders type a head-count instead of digital check-in) appear in the trend instead of being dropped.

## Out of scope
- The 2026-05-03 Unit Meetings discrepancy between manual `total_count` (12/1/19) and digital check-ins (15/15/18) is data-entry, not a code bug. Not changing now; can add a side-by-side comparison in a follow-up if you want.
- No DB schema changes. No RLS changes. No changes to `get_dashboard_stats` RPC.

## Files touched
- `src/pages/Dashboard.jsx` (label/sub-label)
- `src/pages/Analytics.jsx` (label, denominator, trend fallback)
- `src/pages/Attendance.jsx` (rename Total → Active)
- `src/components/dashboard/GrowthIndices.jsx` (denominator)
- delete `src/components/analytics/AttendanceTrends.jsx`
- delete `src/components/analytics/MemberConsistency.jsx`

## Validation
- Visual check on `/t/wci-cardiff/dashboard`, `/analytics`, `/attendance`: numbers consistent, Growth Indices % higher (Active denominator), Attendance Trend now includes Home Cell sessions.
- Build passes (auto-run).
