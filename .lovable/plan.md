## Add subject + course to lecturer ratings

Students rate a lecturer for a specific subject within a course. Same lecturer can be rated multiple times by the same student, once per (course, subject).

## Database migration

Alter `lecturer_ratings`:
- Add `course_id uuid` (fk `exam_titles.id`, nullable for old rows, required for new inserts at app level).
- Add `subject_id uuid` (fk `exam_subjects.id`, nullable for old rows, required for new inserts at app level).
- Drop existing unique `(tenant_id, lecturer_id, submitted_by)`.
- Add unique `(tenant_id, lecturer_id, submitted_by, subject_id)` — one rating per student per lecturer per subject; `course_id` is contextual metadata.
- Keep existing RLS/grants (no change needed since columns are additive).

No changes to `lecturers` table — a lecturer is not permanently tied to a subject; the subject is chosen per rating submission.

## UI changes

`src/components/exams/RateLecturerDialog.jsx`:
- Add two selects above the lecturer dropdown:
  1. **Course** — list active `exam_titles` for tenant.
  2. **Subject** — list `exam_subjects` filtered by selected course (`exam_subjects.title_id = course.id`), active only.
- Lecturer dropdown unchanged (active lecturers in tenant).
- Upsert payload includes `course_id` and `subject_id`. Upsert onConflict switches to `tenant_id,lecturer_id,submitted_by,subject_id`. If the student re-opens the dialog and picks the same course+subject+lecturer, prefill the previously submitted answers and update on save.
- Validation: course, subject, and lecturer are all required before submit.

`src/components/exams/LecturerManager.jsx` — `LecturerFeedbackDialog`:
- Show `Subject` and `Course` names on each submission row (join `exam_subjects(name)` and `exam_titles(name)`).
- Add a small "Filter by subject" select above the list (client-side filter).
- Average rating recalculated over currently filtered rows.

`src/pages/ExamManagement.jsx` — no logic change; the student and admin "Rate a Lecturer" buttons already open the updated dialog.

## Scope guardrails
- Additive migration only; existing rows keep NULL `course_id`/`subject_id` and remain visible in admin feedback view (labelled "—").
- All queries tenant-scoped with `.eq("tenant_id", tenantId)`.
- No changes to grading, certificates, or exam flow.

## Files
- **New migration** — alter `lecturer_ratings` (add columns, swap unique constraint).
- **Edit** `src/components/exams/RateLecturerDialog.jsx` — course + subject selects, updated upsert key, prefill logic.
- **Edit** `src/components/exams/LecturerManager.jsx` — show subject/course in feedback dialog + subject filter.
