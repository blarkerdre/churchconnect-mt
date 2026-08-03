# Why new Bible School attendance sessions disappear

The sessions are being created — they just vanish from the list.

Four "BCC August Edition 2026 - Day 4" sessions dated 6 Aug 2026 were saved today (22:00, 22:02, 22:06), each one apparently a retry after the previous seemed to fail.

Cause: the edition "August Edition 2026" runs 2 Aug – 5 Aug 2026. When a new attendance session is dated outside that window (6 Aug), the database can't match it to any edition, so its edition is left blank. The Attendance tab filters by the selected edition, so a blank-edition session is filtered out and never appears.

## What changes

**Attach the session to the edition you're filtering by**
- When a specific edition is selected in the Bible School edition selector, new attendance sessions are stamped with that edition directly instead of relying on date matching.
- When "All editions" is selected, the existing date-based matching still applies.

**Warn when the date falls outside the edition**
- The New/Edit Attendance Session dialog shows an inline note when the chosen date is outside the selected edition's date range, saying the edition runs from X to Y and the session will still be recorded under that edition.

**Stop silent disappearance**
- After creating a session while a specific edition is selected, if the saved session isn't visible under the current filter, the list shows a short note with a "Show all editions" link.

**Clean up the accidental duplicates**
- Remove the three duplicate 6 Aug "Day 4" sessions that carry no attendance records, keeping one, and attach it (and the other blank-edition sessions of this course) to August Edition 2026.

## Technical notes

- `src/components/exams/WoFBIAttendanceTab.jsx`: include `session_id: isAllEditions || isUnassigned ? undefined : editionId` in the `createSession` insert payload (the `stamp_wofbi_session_id` BEFORE INSERT trigger already yields to a non-null value), and add the same to `updateSession` when the edit dialog's date moves outside the range. Add the out-of-range hint in the session form dialog using `sessions`/`sessionMap` from `useExamSessionFilter`.
- Data fix via migration/data update: delete the duplicate `wofbi_attendance_sessions` rows for course `6dc5df27…` dated 2026-08-06 that have zero `wofbi_attendance_records`, then set `session_id` = `79e1a914…` for the remaining rows of that course with `session_id IS NULL`.
- No change to `resolve_exam_session_for_course` or the edition-filter context.
