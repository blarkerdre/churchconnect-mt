## Feature: Teen On-Premise Attendance

Teens are children of members (aged ~13–17) who don't have their own login. Parents register them once in **My Family → Teens**. At church, a worker displays a **Teens session QR**. The teen scans it on any phone, picks their name from their family's teen list, and taps **Check in**. They scan again on the way out to record **Check out**. Workers can also sign a teen in/out manually.

Only teens who have been registered by a parent (and belong to the tenant) can appear in the list — no random walk-ups.

### Data model (new)

New tables (tenant-scoped, RLS-guarded):

- `teens` — teen roster
  - `primary_guardian_member_id` → parent member
  - `first_name`, `last_name`, `date_of_birth`, `gender`, `photo_url`
  - `access_pin` (optional 4-digit, hashed) — used at the QR step to prevent someone else picking a teen's name off a stranger's phone
  - `is_active`
- `teen_attendance_sessions`
  - `title`, `session_date`, `start_time`, `end_time`, `late_after_minutes`
  - `qr_token` (unguessable), `status` (`open` | `closed`)
- `teen_attendance_records`
  - `session_id`, `teen_id`
  - `checked_in_at`, `checked_in_by` (teen self / member user_id / worker), `status` (`present` | `late`)
  - `checked_out_at`, `checked_out_by`, `duration_minutes`
  - unique `(session_id, teen_id)`

RLS:
- Guardians can read + manage their own teens.
- Admins and users assigned to a "Teens" unit (new church unit, mirroring the Children Church leader pattern) can read all teens, run sessions, and manually sign teens in/out.
- Everyone else: no access.

GRANTs to `authenticated` + `service_role` on all three tables.

### RPC: `teen_checkin(_qr_token, _teen_id, _pin?)`

Security-definer function called from the public teen check-in page. It:

1. Resolves the session by token, rejects if closed / expired.
2. Verifies the teen belongs to the same tenant and is active.
3. Verifies the caller is either:
   - the primary guardian / authorised guardian of the teen, **or**
   - a worker in the Teens unit / admin, **or**
   - an anonymous scanner who supplied the correct `access_pin` for that teen.
4. Inserts `checked_in_at` on first scan; on second scan sets `checked_out_at` and computes duration. Marks `late` if past `late_after_minutes`.
5. Returns `{ ok, action, status, teen_name, session_title, duration_minutes }`.

Mirrors the existing Bible School `wofbi_checkin` RPC in shape and UX.

### UI changes

1. **My Family → Teens tab** (`src/pages/MyFamily.jsx`)
   - New section "Teenagers" under Family with add/edit/remove.
   - Fields: name, DOB, gender, photo, optional 4-digit access PIN.
   - Shows each teen's personal check-in card + a QR containing `?teen=<id>` fallback link (optional print).

2. **Teens Attendance module** (new page, e.g. `src/pages/TeensAttendance.jsx`, gated behind admin / Teens unit leader)
   - List of sessions (Today / Upcoming / Past), Create Session dialog.
   - Per-session: "Show QR" (reuses the QR dialog pattern from `WoFBIAttendanceQRDialog`), live checked-in count, roster of who's in / who's out.
   - Manual sign-in/out: worker picks a teen and taps **Check in** or **Check out** (writes with `checked_in_by = worker.user_id`).

3. **Public teen check-in page** (new route `/teens/checkin/:token`, similar to `WoFBICheckin.jsx`)
   - If signed in as a guardian → shows only that guardian's teens, tap a name to check in / out.
   - If not signed in → prompts for PIN per teen (only teens with a PIN configured are pickable); alternative magic-link sign-in as the guardian is offered.
   - Success screen shows time-in / time-out and duration, matching the Bible School UX.

4. **Sidebar / navigation** — add "Teens Attendance" for admins and Teens unit leaders.

### Technical details

- New church unit slug `teens` (mirrors `children church`), with a `is_teens_unit_member(user_id, tenant_id)` SECURITY DEFINER helper for RLS.
- Session QR URL: `${origin}/t/<slug>/teens/checkin/<qr_token>` (tenant-aware, like WoFBI check-in).
- PIN storage: `access_pin_hash` (bcrypt via `pgcrypto` `crypt()`), never plain text; verified inside the RPC.
- Realtime subscription on `teen_attendance_records` for live QR dialog count, same pattern as WoFBI.
- Reuse `TenantDialogHeader`, `Card`, `Button`, `qrcode.react`, and the duration-formatter helper.
- No new secrets, no edge functions required — everything is RLS + one RPC.

### Out of scope

- Push notifications to parents on check-in/out (can be added later using existing `push_subscriptions`).
- Reporting / analytics beyond the session roster (can be added to Reports Hub later).
