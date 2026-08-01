## Goal
Give Bible School a real "Sessions / editions" lifecycle: create a session, attach courses to it, open it, close it — so registrations, exams and the Course Final Report can be scoped to an intake.

## Why
`exam_sessions` already exists and is read by the Statement of Result and the Course Final Report picker, but nothing in the app writes to it. The only row present was seeded by a migration and is closed, and no course registration carries a `session_id`. Sessions therefore never "start" — there is no screen for it.

## What to build

### 1. New "Sessions" tab in Bible School Management
Admin-only tab listing sessions newest-first with: name, date range, status chip (Upcoming / Open / Closed), attached courses, and counts of registrations and exam attempts.

### 2. Create / edit session dialog
Fields:
- Name / edition label (e.g. "Q1 2026 Edition")
- Description
- Start date, end date
- Pass mark %
- Attached courses — multi-select of Bible School courses, written to `exam_session_courses`
- Toggles already on the table: `auto_open_exams`, `allow_reregistration`

### 3. Start / close controls
- **Start session** — sets `status = 'active'` and stamps `started_at`. Guarded so only one session per course is active at a time (warn and offer to close the other).
- **Close session** — sets `status = 'closed'`, stamps `ended_at`, and blocks new registrations and exam attempts against it.
- **Reopen** — admin-only, returns a closed session to active.
- Optional scheduled start/close using the existing dates, following the same pattern already used for Bible School attendance sessions (a scheduled job flips status when `starts_on` / `ends_on` is reached). Off by default via a per-session checkbox.

### 4. Wire registrations to the active session
When a student registers for a course (member self-register, public form, or QR), stamp `course_registrations.session_id` with the currently active session for that course. Existing behaviour is unchanged when no session is active.

### 5. Report picker follows on
With sessions and `exam_session_courses` populated, the Course Final Report picker built earlier starts showing real editions with dates, status and Draft/Final badges — no further change needed there.

## Technical notes
- New component `src/components/exams/SessionManager.jsx`, mounted as a tab in `src/pages/ExamManagement.jsx`.
- Writes to `exam_sessions` and `exam_session_courses` (linked by `exam_title` text, matching the existing schema).
- Requires RLS insert/update/delete policies for admins on both tables — will verify what exists and add only what's missing, with GRANTs.
- Registration stamping touches the `public-wofbi-register` edge function and the member self-registration path, which already share one flow.
- Scheduled open/close reuses the existing `pg_cron` job pattern from Bible School attendance sessions.

## Not included
- No change to exam taking, grading, or the report layout.
- Existing seeded test session is left alone; it can be renamed or deleted from the new tab.
