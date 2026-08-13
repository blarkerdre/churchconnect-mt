# Why students show up under "Test Session" and "Unassigned edition" in Bible School attendance

## Cause (confirmed)

The attendance roster is built from **all approved registrations of the selected course**, with no edition filter. The attendance *sessions* list respects the edition selector, but the student list does not — so whichever edition you pick (Test Session, Unassigned edition, or any other), the same students appear, with 0% attendance.

The data itself is correctly labelled: of the current registrations, 36 belong to August Edition 2026 and 2 have no edition. None belong to Test Session, yet all of them still render under it.

## Fix

- Scope the attendance roster to the selected edition:
  - a specific edition → only registrations stamped with that edition
  - "Unassigned edition" → only registrations with no edition
  - "All editions" → everything, as today
- Show an edition badge next to each student when "All editions" is selected, so mixed lists stay readable.
- When an edition has no registered students, show a clear empty state ("No students registered for <edition>") instead of a list of unrelated students.
- Apply the same scoping to the attendance summary report, the % report and the roster CSV/PDF exports, and put the edition name in the export header and filename.

No data changes and no changes to saved attendance records — only what the roster displays and exports.

## Technical notes

- `src/components/exams/WoFBIAttendanceTab.jsx`: wrap the `wofbi-att-roster` query (`course_registrations`) in `applySession(...)` from `useExamSessionFilter`, select `session_id` plus `exam_sessions(name)`, and add `editionId` to the query key so caches don't cross-contaminate.
- Downstream memos (`roster`-derived summary rows, `rosterPositions`, export row builders) inherit the filtered list automatically; only the empty-state copy and the "All editions" badge need extra markup.
- Export helpers in `src/lib/attendance-roster.js` stay unchanged; the edition is added via `meta`/`filename` at the call site.
