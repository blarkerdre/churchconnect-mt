
## Goal

Make "Exam Sessions" the unit of work for a Certificate Course cohort. Admins create/edit a session (with schedule), open it, and members can register (and re-register if they previously took it) and take the included course exams while it is active.

## What exists today

- `exam_sessions` (status: draft/active/closed, pass_mark, started_at/ended_at) + `exam_session_courses` join.
- `exam_titles` with `registration_open` / `exams_open` toggles (per-course).
- `course_registrations` (member ↔ course, optional `session_id`).
- `ExamSessionManager` admin UI on `/exam-management`.
- Members register per-course in MyProfile / ExamManagement and take exams when `exams_open` is true.

## Changes

### 1. Schema (single migration)

Add to `exam_sessions`:
- `starts_on date` (nullable) — planned start
- `ends_on date` (nullable) — planned end
- `auto_open_exams boolean default true` — when active, treat included courses as exams-open
- `allow_reregistration boolean default true` — members who took the course before can register again

Add to `course_registrations`:
- Drop the implicit unique on `(member_id, course_id)` if present, replace with unique `(member_id, course_id, session_id)` (NULLs allowed). Keeps history; lets a member re-enrol in a new session.

RLS: keep existing policies; add member-self insert policy for `course_registrations` scoped to active sessions in the member's tenant (already partially present — verify and tighten).

### 2. Admin: ExamSessionManager dialog

Edit `src/components/exams/ExamSessionManager.jsx`:
- Add date pickers for `starts_on` / `ends_on`.
- Add switches: "Auto-open exams while active", "Allow re-registration".
- Show planned dates in the session card.
- Allow editing while `active` (today only `draft` is editable) — restrict to safe fields (description, end date, toggles); name + courses still locked once active.

### 3. Admin: enrol members into a session

Edit `src/pages/ExamManagement.jsx` registrations section:
- New "Bulk Enrol" button on each course/session view → dialog with member multi-select (filter by name/email) → inserts `course_registrations` rows with the chosen `session_id` for each selected course in that session.

### 4. Member: session-aware registration & retake

Edit MyProfile course/exam section + `ExamManagement` member view:
- New "Open Course Sessions" panel listing sessions where `status='active'` in the member's tenant.
  - For each: show name, dates, included courses, and a single "Register for this session" button (creates `course_registrations` rows for all included courses with `session_id`).
  - If the member already has registrations in that session → show "Registered" + per-course "Take Exam" buttons.
  - If member previously took the course in a closed session and `allow_reregistration` is true → show "Register again".
- Filter `registeredCourses` (the existing exams list) by `session_id IN (active sessions)` OR by `c.exams_open` (legacy per-course flow stays).

### 5. Auto-open exams logic

Frontend: in TakeExamDialog launchers, treat a course as available if:
`course.exams_open === true` OR there is an active session containing the course with `auto_open_exams=true` and the member has a registration with that `session_id`.

No change to grade-exam edge function (it already accepts session_id-less context).

### 6. Audit

`logAudit` entries for: session create/edit/start/stop, member self-register, admin bulk enrol.

## Out of scope

- Financial/billing for sessions.
- Public (logged-out) registration flow changes — only `PublicWoFBIRegistration` already handles that and stays as-is.
- Email/SMS broadcasts on session start (can be a follow-up).

## Files touched

- `supabase/migrations/<new>.sql`
- `src/components/exams/ExamSessionManager.jsx`
- `src/pages/ExamManagement.jsx`
- `src/pages/MyProfile.jsx`
- new: `src/components/exams/SessionEnrolDialog.jsx`
- new: `src/components/exams/OpenSessionsPanel.jsx`
