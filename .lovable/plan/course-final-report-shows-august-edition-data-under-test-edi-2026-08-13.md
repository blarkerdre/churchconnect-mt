# Course final report shows August Edition data under Test edition

## What's happening

The Course Report's "Auto-fill from records" only filters one thing by the edition you pick: student registrations. Every other figure it pulls is fetched for the whole course, ignoring the edition:

- Subjects and lecturers list
- Applications count
- Exam attempts (used for "completed the course")
- Student lecturer ratings
- Quality Control checks
- Course feedback / testimonies
- Attendance records

So when "Test Session" is selected, the report still fills in August Edition 2026's 14 subjects, 14 QC checks, 438 ratings, 36 applications, 26 feedback responses, 6 attendance days and 486 exam attempts. Only the registration-derived numbers change.

Records in the database are already stamped with their edition, so the data to filter by exists — the report just isn't using it.

## Fix

Scope every auto-fill query in the Course Report to the selected edition:

- Subjects: only subjects belonging to the chosen edition (this also corrects the courses/lecturers table, honorarium table and "completed" calculation, which are all derived from the subject list).
- Applications, lecturer ratings, QC checks, course feedback: filter by edition.
- Exam attempts: filter by edition as well as the edition's subjects.
- Attendance: only attendance days belonging to the chosen edition.

When "All sessions" is selected, behaviour stays as today (everything for the course).

If the chosen edition has no subjects of its own, the report shows a clear note ("This edition has no subjects yet — copy the syllabus from another edition") instead of silently borrowing another edition's syllabus.

## Technical notes

- File: `src/components/exams/CourseReportTab.jsx`, inside `autofill()`.
- Add `.eq("session_id", sid)` (when `sid` is set) to the queries on `exam_subjects`, `wofbi_applications`, `exam_attempts`, `lecturer_ratings`, `lecturer_qc_checks`, `wofbi_feedback_responses`, and to the embedded `wofbi_attendance_sessions!inner(...)` filter on `wofbi_attendance_records`.
- `subjectIds` then comes from the edition's subjects, so `completed`, `courseRows`, `studentFeedback`, `qcRows`, `honorarium` and `matrixRows` become edition-correct automatically.
- No database or schema changes: all seven tables already carry `session_id`, and existing rows are stamped (only a handful of pre-edition rows remain unassigned and stay out of edition-specific reports).
