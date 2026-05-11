# Let members register and take exams in open sessions

## Problem

Blarker sees the active "Test Session" but the Take Exam buttons never appear. DB confirms zero `course_registrations` rows for them, so the existing flow (My Profile → Open Sessions panel → Register → Bible School subjects appear) is breaking down somewhere. For sessions configured with `auto_open_exams=true` the admin's intent is "anyone in the church can sit this exam", so the registration step should be near-frictionless.

## Solution

Two complementary changes — make registration actually work, and let auto-open sessions skip the manual click entirely.

### 1. Auto-enrol on demand for `auto_open_exams` sessions

`src/pages/MyProfile.jsx` → `DynamicExamButtons`:

- Fetch `exam_session_courses` for the active sessions already loaded in `openSessions`.
- Build a set of course IDs that belong to any active session with `auto_open_exams === true` (mapping `exam_title` name → course id via `exam_titles`).
- Update the `registeredCourses` filter so a course is included when:
  - the member already has a `course_registrations` row AND `c.exams_open` is true, OR
  - the course is part of an active auto-open session (no row required up-front).
- When the member clicks a subject button for a course they have no registration for, insert a `course_registrations` row (`member_id`, `course_id`, `session_id`, `tenant_id`) just before opening `TakeExamDialog`. Idempotent — skip insert if a row already exists for that `(member, course, session)`.

This means Blarker will see the Bible School card with BCC subjects immediately, and the registration row is created the moment they actually start the exam.

### 2. Fix the OpenSessionsPanel registration flow

`src/components/exams/OpenSessionsPanel.jsx`:

- Disable the Register button until the `titleRows` query has resolved (so we never call the mutation with an empty `titleByName` and silently insert zero rows).
- When `inserted === 0` because all rows already existed, show a neutral "Already registered" toast instead of "Enrolled in 0 course(s)".
- Hide the panel entirely for sessions where `auto_open_exams === true` AND the member has no existing rows — they don't need to click Register, the exam buttons appear directly. Keep the panel for manually-controlled sessions (`auto_open_exams=false`) and for re-registration cases.

### 3. No DB / RLS / edge-function changes

Existing RLS on `course_registrations` already allows a member to insert their own row (`m.user_id = auth.uid()` + `user_has_tenant_access`). No migration required.

## Files

- `src/pages/MyProfile.jsx` — extend `DynamicExamButtons` query set, filter, and on-click auto-enrol
- `src/components/exams/OpenSessionsPanel.jsx` — guard Register button, fix toast, hide for auto-open sessions

## Out of scope

- Admin-side `ExamSessionManager` / `SessionEnrolDialog` unchanged
- No change to grading logic, certificates, or RLS policies
