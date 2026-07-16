## Bible School on-premise attendance (QR check-in)

Add a per-course Attendance tab under **Bible School** where admins run QR-based check-in sessions and view an attendance % report per student.

### Data model

New tables (tenant-scoped, RLS + GRANTs, standard `created_at`/`updated_at`):

- **`wofbi_attendance_sessions`**
  - `course_id` → `exam_titles.id`
  - `subject_id` (nullable) → `exam_subjects.id` (optional: which subject/lesson)
  - `session_date`, `title`, `notes`
  - `status` (`open` / `closed`)
  - `qr_token` (uuid, unique) — rotates when session opens
  - `late_after` (time, optional) — check-ins after this timestamp on the session date are marked "Late"
  - `created_by`

- **`wofbi_attendance_records`**
  - `session_id` → `wofbi_attendance_sessions.id`
  - `registration_id` → `course_registrations.id` (roster row)
  - `member_id`
  - `status` (`present` / `late` / `absent`)
  - `checked_in_at`
  - Unique `(session_id, registration_id)`

RLS:
- Admins & lecturers of the tenant can read/write both tables.
- Students can insert their own record via QR flow (below).

### QR check-in flow

- Admin opens a session on the Attendance tab → app generates/rotates `qr_token` and shows a big QR + short code.
- QR encodes: `/wofbi/checkin/:qr_token` (public route, tenant-resolved from session).
- Student opens link on their phone:
  - If signed in and enrolled in the course → one-tap "Check me in" → inserts record (present or late based on `late_after` vs now).
  - If not signed in → prompted to log in first, then redirected back to the same URL.
  - If not enrolled in that course → shown "Not on the roster" message.
- Duplicate scans return the existing record (idempotent).
- Closing the session freezes new check-ins; all remaining registrants stay `absent` for reporting.

Because check-in inserts must work for the student, add a `SECURITY DEFINER` RPC `wofbi_checkin(qr_token uuid)` that validates: session is open, tenant match, caller has an active `course_registrations` row on that course, computes present/late from `late_after`, and upserts the record. Keeps RLS strict and avoids granting direct INSERT to students.

### UI

New file `src/components/exams/WoFBIAttendanceTab.jsx`, mounted as a new tab `TabsTrigger value="attendance"` in `src/pages/ExamManagement.jsx`.

Tab layout:

- **Course selector** (reuses `exam_titles`).
- **Sessions list** for that course: date, title, present/late/absent counts, status, actions (Show QR, Close, Edit, Delete).
- **New session** dialog: date, title, optional subject, optional "Mark late after" time.
- **QR dialog**: fullscreen-friendly QR (existing `qrcode` lib), the short URL, live-updating count of check-ins (Supabase Realtime on `wofbi_attendance_records` filtered by `session_id`), "Close session" button.
- **Roster panel** (per session): registrant list with status pill; admin can manually override a student's status (present/late/absent) if needed.

**Attendance % report per student** (sub-section of the tab):

- For the selected course, table of registrants with:
  - Sessions attended (present + late)
  - Sessions late
  - Sessions absent
  - Attendance % = (present + late) / total sessions
- CSV export button.

Public check-in page:

- New route `/wofbi/checkin/:token` → `src/pages/WoFBICheckin.jsx`.
- Calls the `wofbi_checkin` RPC, shows success/late/failure state with the session title and student's name.

### Files touched

- Migration: create the two tables + GRANTs + RLS + `wofbi_checkin` RPC.
- `src/pages/ExamManagement.jsx` — add the tab.
- `src/components/exams/WoFBIAttendanceTab.jsx` — new.
- `src/components/exams/WoFBIAttendanceQRDialog.jsx` — new (QR + live count).
- `src/pages/WoFBICheckin.jsx` — new public page.
- `src/App.jsx` (or router) — register `/wofbi/checkin/:token`.

### Notes / non-goals

- Does not touch general church `attendance_sessions` — Bible School attendance lives entirely in its own tables so registrant-only rosters and per-course reporting stay clean.
- No email/SMS on check-in.
- Manual admin marking is available as a fallback, but the primary path is QR self check-in.
