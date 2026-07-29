## Goal
Let admins assign a lecturer to each Bible School subject, so the Lecturer's Name field auto-fills when a subject is picked in Rate Lecturer and the Quality Control Checklist.

## Current state
`exam_subjects` has no lecturer column (verified: id, course_id, name, description, sort_order, is_active, pass_mark_percentage, time_limit_minutes, randomize_questions, tenant_id, grade_classifications, is_open). Both `RateLecturerDialog.jsx` and `QcCheckDialog.jsx` load all active lecturers into an independent dropdown with no link to the chosen subject.

## Changes

1. Database
   - Add nullable `lecturer_id uuid` to `public.exam_subjects`, referencing `public.lecturers(id)` with `ON DELETE SET NULL`, plus a supporting index.
   - Existing subjects stay unmapped until an admin assigns a lecturer.

2. Subject setup (`src/components/exams/SubjectManager.jsx`)
   - Add a "Lecturer" dropdown to the add/edit subject dialog, listing active lecturers for the tenant, with a "None" option.
   - Save `lecturer_id` on create and update; show the mapped lecturer's name as a small line under each subject in the list, or "No lecturer assigned".

3. Rate Lecturer (`src/components/exams/RateLecturerDialog.jsx`)
   - Include `lecturer_id` in the subjects query.
   - On subject selection, auto-fill the lecturer from the mapping. If the subject has no mapping, leave the dropdown for manual selection.
   - When a mapping exists, lock the Lecturer select (read-only display) so students can't mismatch it; an existing saved rating still loads normally.

4. Quality Control Checklist (`src/components/exams/QcCheckDialog.jsx`)
   - Same subject query change and auto-fill on subject selection.
   - Keep the Lecturer field editable here (QC team can correct it), but pre-set it from the mapping. The existing one-QC-per-lecturer-and-subject duplicate guard is unchanged.

## Notes
The mapping is optional, so nothing breaks for subjects that aren't mapped yet — both forms fall back to today's manual selection.
