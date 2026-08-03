# Group, filter and report Bible School by Session/Edition

Today only three areas know which edition a record belongs to (course registrations, exam attempts, course reports). Applications, attendance sessions, lecturer ratings, QC checks and course feedback responses have no session link, so they cannot be filtered or grouped by edition. This adds a session link everywhere and a single edition filter that drives the whole Bible School module.

## What you get

- A **Session / Edition selector at the top of Bible School**, next to the tabs. Pick "BCC August Edition 2026" (or "All editions") once and every tab below — Applications, Registrations, Attendance, Lecturer Feedback, Quality Control, Results, Course Report — shows only that edition's records.
- The selector remembers your choice while you move between tabs and defaults to the currently open session (or the most recent closed one when none is open).
- Every list gets an "Edition" column/badge so mixed views stay readable.
- **Grouping by edition** in the reports: Lecturer Feedback report, QC report, attendance rosters and results can be grouped by edition, with per-edition subtotals.
- **Exports carry the edition**: CSV/PDF/roster/statement exports include the edition name in the filename, header and rows.
- Course Report already picks a session; it stays as-is but now pulls its statistics only from that edition's applications, attendance, ratings and QC.

## Data changes

Add a nullable `session_id` (referencing `exam_sessions`) to:

- `wofbi_applications`
- `wofbi_attendance_sessions`
- `lecturer_qc_checks`
- `lecturer_ratings`
- `wofbi_feedback_responses`

Backfill existing rows by matching the record's course plus its date against the session date range via `exam_session_courses` (rows with no match stay blank and show as "Unassigned edition"). New records are stamped automatically with the active session for that course at creation time, using a trigger so QR/self-service and edge-function paths are covered too. Indexes on `(tenant_id, session_id)` for each table. Existing RLS policies stay unchanged; no new grants needed beyond the current ones.

## Technical notes

- New `ExamSessionFilterContext` (provider in `src/pages/ExamManagement.jsx`) exposing `{ sessionId, setSessionId, sessions, sessionMap }`, persisted in `sessionStorage` per tenant.
- Each consumer (`WoFBIApplicationsTab`, `WoFBIAttendanceTab`, `LecturerFeedbackReport`, `QcReport`, `CourseResultsView`, `SendResultsDialog`, `StatementOfResult`, `CourseReportTab`) reads the context and adds `.eq("session_id", sessionId)` when a specific edition is selected, alongside the existing `.eq("tenant_id", tenantId)` guard. Query keys gain `sessionId` so caches don't cross-contaminate.
- Registration/attendance/QC/rating creation paths set `session_id` client-side where the session is known; the DB trigger is the fallback.
- Reports gain a `groupBy: "edition"` option reusing the existing grouped-table/CSV rendering pattern used elsewhere in the app.
- Edge functions that insert applications/registrations (`public-wofbi-register`) resolve and store the session id explicitly.
