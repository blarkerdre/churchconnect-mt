## Goal
A student may rate each Bible School subject only once. Since a subject has exactly one lecturer (while a lecturer may teach several subjects in a course), uniqueness must key on the subject + student, not lecturer + subject + student.

## Current state
The database index `lecturer_ratings_unique_per_subject` is on `(tenant_id, lecturer_id, submitted_by, subject_id)`. That lets the same student submit multiple ratings for one subject by picking a different lecturer. No existing rows violate the stricter rule, so the change is safe.

## Changes

1. Database
   - Drop `lecturer_ratings_unique_per_subject`.
   - Create a unique index on `(tenant_id, subject_id, submitted_by)`.

2. Rate Lecturer form (`src/components/exams/RateLecturerDialog.jsx`)
   - Change the upsert conflict target to `tenant_id,subject_id,submitted_by`.
   - Look up any existing rating by subject + student only (drop the lecturer filter), so a previously submitted rating loads for editing as soon as the subject is chosen.
   - When an existing rating loads, pre-select its lecturer.
   - Show an inline note when the selected subject already has a rating ("You already rated this subject — submitting will update your feedback").
   - Update the helper text at the top to "You can rate each subject once."

## Notes
Existing feedback data is preserved; resubmitting for the same subject updates the earlier entry rather than creating a duplicate.
