## Goal
Rate each student's punctuality in Bible School attendance: an automatically calculated score from their attendance history, plus an optional manual rating/comment per session.

## What gets built

**1. Auto-calculated punctuality score**
For each student, across all sessions of the selected filter (course/subject/date range):
- Score = (Present × 100 + Late × 50 + Absent × 0) / total sessions
- Grade bands: Excellent (90–100), Good (70–89), Fair (50–69), Poor (below 50)
- Requires no data entry — computed from existing Present/Late/Absent records.

**2. Manual override per session**
- On the attendance session marking list, each student gets a small 1–5 star punctuality control plus an optional short comment.
- Stored on the attendance record; leaving it blank keeps the auto value.
- Editable from the existing edit-record dialog too.

**3. Attendance session view**
- Star rating control next to each student row (alongside the Present/Late/Absent buttons), with the auto grade shown as a subtle hint badge.
- Works on mobile: stars stack under the status buttons at narrow widths.

**4. Cumulative attendance report**
- New "Punctuality" column showing the auto score % + grade badge, and the average manual star rating where present.
- Included in the CSV export as two columns: `Punctuality %` and `Punctuality Rating`.
- Sortable/filterable alongside existing report filters.

## Technical details
- Migration on `wofbi_attendance_records`: add `punctuality_rating smallint` (1–5, nullable, validated via trigger or check on the range) and `punctuality_note text` (nullable). Existing RLS policies already cover these columns; no new policies or grants needed since no new table is created.
- `src/components/exams/WoFBIAttendanceTab.jsx`: extend `markStatus` and the edit-record mutation to write the new fields; add the star control to the roster rows and edit dialog; compute the auto score in a memo from the fetched records.
- Cumulative report component in the same file: add the punctuality column, badge, and CSV columns.
- All queries keep the existing `.eq("tenant_id", tenantId)` guards.
