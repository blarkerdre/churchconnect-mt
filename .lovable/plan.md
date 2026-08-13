# How attendance, lecturers and "awaiting a QC check" relate to editions — and the gap to close

## Current behaviour

**Attendance — edition-aware.**
`wofbi_attendance_sessions` carries an edition (`session_id` to `exam_sessions`). When a specific edition is selected in the Bible School edition bar, new attendance sessions are stamped with it; otherwise a date-range trigger matches one. The attendance list, roster, counts and reports are all filtered by the selected edition, and each row shows its edition. Attendance records belong to an attendance session, so they inherit the edition.

**Lecturers — deliberately not edition-scoped.**
`lecturers` is one tenant-wide directory with no edition column. The per-edition link is the subject: each `exam_subjects` row belongs to an edition and names its lecturer. So "who taught what, in which edition" is answered through subjects, and the same lecturer can appear in many editions.

**QC — edition-aware in the records, not in the pickers.**
`lecturer_qc_checks` has an edition column and the QC report filters by the selected edition. Because subjects are now per edition, the "one QC per subject" unique rule already means a new edition starts with a clean QC slate.

## The gap

Two lists still ignore the edition selector:

- **"N subjects still awaiting a QC check"** in the QC report loads every active subject in the tenant, across all editions. With "August Edition 2026" selected it still lists last edition's subjects as outstanding, and it compares them against the edition-filtered checks, so counts are inflated.
- **The subject dropdown in the New QC Check dialog** lists a course's subjects from all editions, and its "already checked" flags come from every QC check in the tenant, so a subject can look done when it is only done in another edition.

## What changes

- The outstanding-QC hint respects the edition selector: with a specific edition selected it lists only that edition's subjects; with "All editions" it lists everything and shows an edition badge per subject.
- The New QC Check subject dropdown lists only the selected edition's subjects for the chosen course, and the "already has a QC" markers are computed within that edition. With "All editions" selected, the dropdown keeps today's behaviour but labels each subject with its edition.
- The QC report and dialog headers state which edition the QC is being recorded under, so a check can't be logged against the wrong edition by accident.
- No change to lecturers, attendance, the database schema, RLS or the uniqueness rule.

## Technical notes

- `QcReport.jsx`: `qc-outstanding-subjects` query gains `sessionId` in its key and applies `applySession(...)` (with the unassigned/all cases from `useExamSessionFilter`); select `exam_sessions(name)` for the badge.
- `QcCheckDialog.jsx`: `qc-subjects` and `qc-checked-subjects` queries gain the edition filter and `sessionId` in their keys; new QC inserts already carry `session_id` via the existing trigger, and the dialog passes the pinned edition explicitly when one is selected.
