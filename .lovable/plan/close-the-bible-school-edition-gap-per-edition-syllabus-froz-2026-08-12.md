# Close the Bible School edition gap: per-edition syllabus + frozen history

Today subjects and exam questions belong to a course only, not to a session/edition. Editing a subject, its pass mark, its lecturer, or its questions for the new edition silently rewrites what the previous edition taught and examined — and old statements, results and reports re-read those same rows, so past documents change too.

This closes both halves: each edition gets its own syllabus, and past results keep a frozen copy of what the student actually sat.

## Part 1 — Per-edition syllabus

- Subjects become edition-aware. A subject belongs to a course **and** an edition.
- When you open a new edition, Bible School offers **"Copy syllabus from previous edition"**: it duplicates that edition's subjects (name, code, description, lecturer, pass mark, time limit, grading, order) and, optionally, their exam questions into the new edition. Nothing is moved or deleted from the old one.
- Editing or deleting a subject or question now only affects the edition you are working in.
- The Subjects list, question editor, exam preview, lecturer assignment, QC and lecturer-feedback subject pickers all follow the edition selected in the Bible School edition bar. With "All editions" selected, subjects show an edition badge.
- Existing subjects are kept as-is and attached to the current/most recent edition of their course, so nothing disappears.

## Part 2 — Frozen history on results

- When a student submits an exam, the attempt stores a snapshot of the subject as it was at that moment (subject name, code, pass mark, time limit, lecturer name) and each answer stores the question text and the options shown.
- Statements of Result, certificates, course results, rankings and course reports read the snapshot when present, falling back to live data for older records.
- Result: editing or deleting a subject or question never changes an already-issued statement or a past student's paper.

## Data changes

`exam_subjects`
- add `session_id` (nullable, references `exam_sessions`) + index on `(tenant_id, session_id, course_id)`
- backfill: attach each existing subject to the newest session linked to its course via `exam_session_courses`; leave null where no session exists ("Unassigned edition")
- relax any uniqueness on `(course_id, name)` to include `session_id`

`exam_questions`
- add `session_id` (nullable, references `exam_sessions`), stamped from the parent subject on insert via trigger; index on `(tenant_id, session_id, subject_id)`
- backfill from the parent subject

`exam_attempts`
- add `subject_snapshot` (jsonb, nullable) — name, code, pass mark, time limit, lecturer name, edition name

`exam_answers`
- add `question_snapshot` (jsonb, nullable) — question text, options, correct-answer marker, points

New DB function `clone_exam_subjects_to_session(p_tenant_id, p_course_id, p_from_session, p_to_session, p_include_questions boolean)` — SECURITY DEFINER, admin-only, inserts copies and returns counts. Existing RLS on these tables is unchanged; the new columns inherit it. No new grants needed.

## Technical notes

- `SubjectManager.jsx`: read `sessionId` from `useExamSessionFilter()`, filter the subjects query by it, include it in inserts, and add it to query keys. Question-count query filters by the same edition.
- New `CopySyllabusDialog.jsx` in `src/components/exams/`, launched from `SessionManager.jsx` (row action) and from an empty Subjects list — pick source edition, toggle "also copy questions", calls the clone RPC and invalidates `exam-subjects` / `exam-question-counts`.
- Subject pickers in `QcCheckDialog.jsx`, `RateLecturerDialog.jsx`, `QcReport.jsx`, `LecturerFeedbackReport.jsx`, `WoFBIAttendanceTab.jsx`, `CourseResultsView.jsx`, `CourseReportTab.jsx`, `StudentsReportTab.jsx` and `ExamManagement.jsx`'s `all-exam-subjects` query gain the edition filter (skipped when "All editions").
- `TakeExamDialog.jsx` writes `subject_snapshot` on attempt creation and `question_snapshot` per answer row on submission (single insert payload, no extra round-trips).
- `StatementOfResult.jsx`, `CourseResultsView.jsx`, `src/lib/rank-utils.jsx`, `src/lib/wofbi-report-*.js` and `CourseReportTab.jsx` prefer the snapshot fields with a live-data fallback.
- Deletion of a subject/question stays password-confirmed and now warns that only the current edition is affected.
