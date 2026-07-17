## Teens Attendance — consent, session types, and permissions

### 1. Parent consent (one-time per teen)

Add consent fields to `teens`:
- `attendance_consent boolean NOT NULL DEFAULT false`
- `attendance_consent_at timestamptz`
- `attendance_consent_by uuid` (guardian's `auth.uid`)

**UI (MyFamily → teen form / TeensSection):** consent checkbox editable only by the primary guardian, with a small "Consent given on <date>" caption. Guardians can revoke at any time.

**Enforcement:** `teen_checkin` RPC returns `{ok:false, error:'no_consent'}` when `attendance_consent=false`. Roster dialog hides the In/Out buttons and shows a "No parent consent" badge for teens without consent; QR self-select screen shows a clear message and no name row.

### 2. Session title from existing service types

Reuse the hardcoded list already used by `SessionFormDialog` (Sunday Service, Midweek Service, Special Service, Bible School, Prayer Meeting, Special Event, Other — skipping Unit/Home Cell Meeting which don't apply to teens).

- Add `session_type text` to `teen_attendance_sessions`.
- `NewSessionDialog` (in `TeensAttendance.jsx`): replace the free-text Title input with a Select of service types. Session `title` is auto-derived as `"{session_type} - {formatted date}"` so the existing list UI keeps working.

### 3. Permissions — Teens unit leader vs member

Introduce two DB helpers alongside the existing `is_teens_unit_member` (which today mixes both roles):
- `public.is_teens_unit_leader(_user, _tenant)` — checks `unit_leader_assignments` for a Teens unit (current behaviour).
- `public.is_teens_unit_member(_user, _tenant)` — rewritten to check `members.church_unit` containing a Teens unit name.

Update `teen_attendance_sessions` policies:
- SELECT: any tenant member (unchanged).
- INSERT: admin OR teens leader OR teens member.
- UPDATE:
  - Admin / teens leader: any column.
  - Teens member: only when the change is limited to `status` (i.e. closing a session). Enforced via a `BEFORE UPDATE` trigger that raises when a non-leader/non-admin touches anything other than `status`/`updated_at`.
- DELETE: admin OR teens leader only.

`teen_attendance_records` write policy: admin OR teens leader OR teens member (so members can sign teens in/out during a session).

**Frontend gating (`TeensAttendance.jsx`):**
- New hook `useTeensUnitRole()` returning `{ isLeader, isMember }`.
- New session button: visible to admin/leader/member.
- Edit / Delete / "Report" buttons: leader + admin only.
- Close session button: leader + admin + member.
- Roster manual sign in/out: leader + admin + member.
- QR display: leader + admin + member.

### 4. Reports (leader/admin only)

New "Report" button per session opens a dialog listing every teen with columns: name, checked-in time, late flag, checked-out time, duration, source (QR/manual/worker). Includes CSV export and a "Print" action. No new tables; queries `teen_attendance_records` joined to `teens`.

### Technical details

**Migration:**
1. `ALTER TABLE public.teens ADD COLUMN attendance_consent ...` (+ two audit columns).
2. `ALTER TABLE public.teen_attendance_sessions ADD COLUMN session_type text`.
3. Replace `is_teens_unit_member` with member-based check; add `is_teens_unit_leader`.
4. Drop and recreate the four teen_attendance_sessions policies + one teen_attendance_records write policy per rules above.
5. `CREATE TRIGGER` on `teen_attendance_sessions` restricting non-leader/non-admin updates to `status`.
6. Rewrite `public.teen_checkin` to also enforce `attendance_consent`.

**Frontend files touched:**
- `src/pages/TeensAttendance.jsx` — role hook, dropdown for session type, gated buttons, Report dialog.
- `src/components/teens/TeensSection.jsx` and/or `src/pages/MyFamily.jsx` — consent checkbox on teen form.
- `src/components/teens/TeenAttendanceQRDialog.jsx` — surface `no_consent` error.
- `src/pages/TeensCheckin.jsx` — hide teens without consent from the self-select list and show inline explanation.
- New `src/hooks/useTeensUnitRole.jsx`.

**Out of scope:** SMS/email reminders to guardians, per-session consent overrides, new Settings section for service types (reusing the existing hardcoded list per your answer).