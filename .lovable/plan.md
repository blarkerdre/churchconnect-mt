## Goal
Allow a member to enrol in the same Bible School / certificate course again under a **different exam session** (new cohort or retake), instead of being blocked forever after their first enrolment.

## Current behaviour
- `course_registrations` has `UNIQUE (member_id, course_id)` and no `session_id` column.
- Once a member registers for a course, they can never register again — even after the session closes or in a brand-new session.
- The public Bible School registration form picks a course but never asks which session.

## Proposed changes

### 1. Database
- Add `session_id uuid` (nullable, FK → `exam_sessions.id ON DELETE SET NULL`) to `course_registrations`.
- Drop the existing `UNIQUE (member_id, course_id)` constraint.
- Add new partial unique constraint: `UNIQUE (member_id, course_id, session_id)` so a member can only register once **per (course, session)** pair, but can re-register in a different session.
- Backfill: leave existing rows with `session_id = NULL` (legacy enrolments).
- Index on `(session_id, course_id)` for lookup speed.

### 2. Public registration (`PublicWoFBIRegistration.jsx` + `public-wofbi-register` edge function)
- Fetch open exam sessions for the tenant (status = `active` or `draft` with `registration_open=true` — confirm in build) plus the courses each session offers (`exam_session_courses`).
- Form flow: **Select Session → Select Course (filtered to that session's courses)**.
- Edge function:
  - Accept and validate `session_id`; verify it belongs to the tenant and is open.
  - Verify the chosen `course_id` is actually included in `exam_session_courses` for that session.
  - Duplicate check uses `(member_id, course_id, session_id)` instead of `(member_id, course_id)`.
  - Insert registration with `session_id`.

### 3. Admin / internal flows
- `ExamSessionManager`, `CourseResultsView`, `MyCertificates`, `IssueCertificateDialog`, exam-taking flow: scope registrations & results by `session_id` so retakes are tracked per session.
- Member profile "My Certificates" / course list shows session name alongside each enrolment.
- Grading / results queries already iterate per session — confirm they join via the new `session_id` rather than just `course_id`.

### 4. UI copy
- Public form: add a "Select Session" step with session name + description.
- Member self-service: if a member already completed a course, show a "Re-enrol in new session" option when another open session offers the same course.

## Files to touch (build phase)
- New migration: add column, drop+recreate unique constraint, add index.
- `src/pages/PublicWoFBIRegistration.jsx` — add session selector, filter courses by session.
- `supabase/functions/public-wofbi-register/index.ts` — accept `session_id`, validate, dedupe per session.
- `src/components/exams/ExamSessionManager.jsx` and result/certificate views — surface session context per registration.
- `src/components/certificates/MyCertificates.jsx` — show session.
- `src/integrations/supabase/types.ts` — auto-regenerated after migration.

## Out of scope
- Migrating existing legacy registrations into a specific session (left as `NULL`).
- Payment/fees per session.
- Limiting how many sessions a member may join concurrently.