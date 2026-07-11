## Goal

When a Bible School (WoFBI) record is deleted — either a **Course Registration** row or a **Application form response** row — automatically remove **every** related Bible School record for that member, so no orphaned exam data, ratings, QC checks, or certificates remain.

## Scope of cascade

For the affected `(member_id, course_id)` pair (course-registration deletion) or `(member_id, course_id)` from the application (application deletion — cascades that course only; if the application has no course_id, cascades all Bible School courses for that member):

1. `wofbi_applications` — the registration form response(s)
2. `course_registrations` — the enrolment row
3. `exam_attempts` + `exam_answers` — every attempt across every subject under that course
4. `training_completions` — the training row and certificate for that course
5. `lecturer_ratings` — ratings the member gave for that course
6. `lecturer_qc_checks` — QC checks for the member on that course

Out of scope: exam questions, subjects, course definitions, and other members' data.

## Implementation

### 1. New SECURITY DEFINER RPC (migration)

`public.cascade_delete_bible_school_records(_member_id uuid, _course_id uuid default null)`

- Auth guard: caller must be admin/tenant_admin/tenant_owner for the member's tenant (use `has_role` / `user_has_tenant_access`).
- Resolves `training_type` from `exam_titles.name` for the given course_id (or all WoFBI courses for the member if `_course_id` is null).
- Resolves `subject_ids` from `exam_subjects.course_id`.
- Deletes in FK-safe order:
  1. `exam_answers` where `attempt_id in (select id from exam_attempts where member_id = _member_id and (subject_id in subjects OR training_type in types))`
  2. `exam_attempts` same filter
  3. `lecturer_qc_checks` where `member_id = _member_id and course_id = _course_id` (or all when null)
  4. `lecturer_ratings` where `member_id = _member_id and course_id = _course_id`
  5. `training_completions` where `member_id = _member_id and training_type in types`
  6. `course_registrations` where `member_id = _member_id and (course_id = _course_id or true)`
  7. `wofbi_applications` where `member_id = _member_id and (course_id = _course_id or _course_id is null)`
- Writes one `audit_log` row summarising counts per table.
- Returns a JSON summary `{ attempts, answers, completions, ratings, qc, registrations, applications }`.

### 2. Wire up in Course Registrations delete (`src/pages/ExamManagement.jsx`)

Replace the direct `.from("course_registrations").delete()` in `deleteMutation` with a call to `supabase.rpc("cascade_delete_bible_school_records", { _member_id, _course_id: course.id })`. Update the confirmation dialog copy to state that all Bible School records for this member and this course will be permanently removed (attempts, results, certificate, ratings, QC, application).

### 3. Wire up in Applications tab (`src/components/exams/WoFBIApplicationsTab.jsx`)

In `deleteApplications` mutation, for each selected application call the RPC with `_member_id = a.member_id` and `_course_id = a.course_id`. For rows where `member_id` is null (public form not yet linked), fall back to today's behaviour: just delete the `wofbi_applications` row. Update the confirm dialog copy to warn that all Bible School data for the applicant will be removed.

### 4. Confirmation UX

Both dialogs get a red highlighted list of what will be deleted, and require the current typed word "DELETE" is NOT required — the existing single-confirm button stays, but the description is expanded so admins understand the cascade.

## Technical notes

- The RPC is `SECURITY DEFINER` with `SET search_path = public` and re-checks tenant membership inside to prevent cross-tenant deletes.
- All deletes stay tenant-scoped via `tenant_id = (select tenant_id from members where id = _member_id)`.
- No schema changes to existing tables; no ON DELETE CASCADE changes (kept surgical to the RPC).
- Audit log entry uses action `bible_school.cascade_delete` for traceability.

## Not in scope

- Undo / soft-delete.
- Restoring certificates from `purged_data_archives`.
- Changes to `first_timers`, `wsf_*`, or non-WoFBI training records.