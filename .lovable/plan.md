## Goal
Make a Bible School session (edition) the thing that opens and closes applications and registrations for its attached courses, instead of the manual "Registration open" switch being the only control.

## How it will work

### 1. Session start opens registration
When a session moves to **Open** — manually via the Start button, or by the auto-schedule job on its start date — every course attached to that session (`exam_session_courses`) gets `registration_open = true`.

### 2. Session close shuts registration
When a session moves to **Closed** — manual Close, or the auto job passing the end date — the attached courses get `registration_open = false`, so the public link/QR and member self-registration both stop accepting entries.

A course attached to *no* session is untouched and keeps behaving exactly as today (pure manual switch).

### 3. Exams follow the same rule, but only if asked
The session already has an **"Open exams automatically"** switch that is stored but never read. It will now do what it says: when the session opens, attached courses get `exams_open = true`; when it closes, `exams_open = false`. Left off, exams stay entirely manual.

### 4. Registration blocked outside an open session
The public registration edge function currently only checks the course's `registration_open` flag. It will additionally reject when the course belongs to at least one session and none of those sessions is currently open — with a clear message ("Registration for this course is not currently open"). Courses with no sessions keep the current check.

### 5. Making it visible in the UI
- **Courses tab**: when a course is governed by a session, the "Registration open" switch shows a note — "Controlled by session: {name}" — and reads as derived rather than something you flip blind. Admins can still override manually; the next session start/close will reassert.
- **Sessions tab**: the Start and Close confirmations spell out which courses will have registration (and exams, if enabled) opened or closed.

## Technical notes
- A database trigger on `exam_sessions` status change applies the flag updates to `exam_titles` rows joined through `exam_session_courses`, tenant-scoped. This covers both manual and cron-driven transitions in one place, so `auto_manage_exam_sessions()` needs no change.
- Edge function `public-wofbi-register` gains the "is any attached session open" check alongside the existing `registration_open` / `is_active` guard.
- Frontend touches: `src/components/exams/SessionManager.jsx` (confirm copy) and the Courses tab in `src/pages/ExamManagement.jsx` (session-controlled hint).

## Not included
- No change to how student numbers, confirmation emails, or exam links are sent.
- No change to attendance sessions (`wofbi_attendance_sessions`) — separate concept, unchanged.
- Existing registrations and applications are not retroactively altered.
