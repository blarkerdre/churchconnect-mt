## Goal
Let admins delete a member's entire course result from the Course Results view, and revoke the corresponding certificate.

## UX
In `src/components/exams/CourseResultsView.jsx`, add a small "Delete" (trash icon) action in each member row's status cell, visible only to admins (`isAdmin`). Clicking it opens a confirmation dialog (reuse `DangerConfirmDialog`) that explains:
- All exam attempts for this member in this course will be permanently deleted
- Any issued certificate for this course will be revoked
- This cannot be undone

## Behavior
On confirm, perform (tenant-scoped) in sequence:
1. Delete `exam_attempts` where `member_id = m.id` AND `subject_id IN (subjectIds)` AND `tenant_id = course.tenant_id`.
2. Delete `training_completions` where `member_id = m.id` AND `training_type = course.name` AND `tenant_id = course.tenant_id`.
3. `logAudit("course_result_delete", "exam_attempts", m.id, { course_id, course_name, subject_ids }, course.tenant_id)`.
4. Invalidate `course-attempts` and `training-completions` queries; toast success.

`exam_answers` rows are removed automatically via existing FK cascade on `exam_attempts` (verified in schema). If cascade is not present we'll delete `exam_answers` for those attempt ids first — checked during implementation.

## Scope guardrails
- Frontend-only change plus reliance on existing RLS (admins already delete attempts elsewhere).
- No changes to grading, retake, or certificate-issue logic.
- Every DB call includes explicit `.eq("tenant_id", course.tenant_id)`.

## Files
- `src/components/exams/CourseResultsView.jsx` — add delete button, confirm dialog state, mutation.