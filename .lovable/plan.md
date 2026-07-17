## Teen Self Check-in with Worker-Approved First Scan

Allow already-registered teens to check themselves in/out without needing a parent to be signed in. First-time use requires a Teens Church worker to approve the teen on-device; the teen then sets a 4-digit self check-in PIN they reuse thereafter. Parent attendance consent is still required.

### User flow

1. Teen scans the session QR on their own phone. Not signed in → new "I'm a teen" option appears alongside the existing "Parent sign in" and "Use PIN" options.
2. Teen taps **I'm checking myself in** → picks their name from a searchable list of teens registered in this tenant with attendance consent = true.
3. If the teen already has a `self_pin_hash`, they enter their 4-digit self-PIN and are checked in/out.
4. If not, they see: *"Ask a Teens Church worker to approve you on their device."* A pending self-enrolment row is created (status `pending`, expires in 15 min).
5. A Teens Church member/leader opens **Teens Attendance → Pending self-enrolments** on their own device, sees the request with teen name + photo, taps **Approve**. Approval writes `approved_by` + `approved_at`.
6. Teen's page (polling every ~3s) sees approval → prompts them to set a 4-digit PIN (confirm twice), then completes check-in immediately.
7. Next time, the teen just picks their name and enters the PIN — no worker needed.

Parent attendance consent still gates everything (existing `no_consent` error stays in place). Worker approval only unlocks self-PIN enrolment; it doesn't bypass consent.

### Database

New table `teen_self_enrolments`:
- `teen_id`, `tenant_id`, `session_id` (nullable), `status` (`pending`/`approved`/`rejected`/`used`), `requested_at`, `approved_by`, `approved_at`, `expires_at` (default `now() + interval '15 min'`).
- GRANTs: `authenticated` (workers approve) + `anon` for the teen's polling RPC; `service_role` all.
- RLS: workers (admins + `is_teens_unit_member`) can select/update pending rows in their tenant; inserts and status polling happen through SECURITY DEFINER RPCs (no direct anon access to the table).

New column on `teens`: `self_pin_hash text` (bcrypt via `crypt()`), plus `self_pin_set_at timestamptz`. Distinct from the existing `access_pin_hash` (parent-controlled PIN) so parents keep their override.

### RPCs (all `SECURITY DEFINER`, `SET search_path = public`)

- `teen_self_request_enrolment(_qr_token uuid, _teen_id uuid)` → validates session open, teen active + tenant matches session + `attendance_consent = true`, inserts a `pending` row, returns `{ ok, enrolment_id }`. Executable by `anon, authenticated`.
- `teen_self_check_enrolment(_enrolment_id uuid)` → returns `{ status, expires_at }`. Executable by `anon, authenticated`. Used for teen-side polling.
- `teen_self_set_pin(_enrolment_id uuid, _pin text)` → requires the enrolment to be `approved` and unexpired; writes `self_pin_hash = crypt(_pin, gen_salt('bf'))` on the teen, marks the enrolment `used`. Executable by `anon, authenticated`.
- `teen_self_checkin(_qr_token uuid, _teen_id uuid, _pin text)` → validates consent + `self_pin_hash` match, then reuses the existing check-in/-out logic (extract shared body of `teen_checkin` into an internal helper, or add a `_self_pin` branch inside the existing function; plan uses the latter to minimise churn). Executable by `anon, authenticated`.
- Worker-side: reuse standard table access through RLS + `teen_self_approve(_enrolment_id uuid)` / `teen_self_reject(_enrolment_id uuid)` SECURITY DEFINER RPCs that verify the caller is admin or Teens unit member for the tenant and set status + `approved_by = auth.uid()`. Approval also writes an audit log row.

Rate limit: at most 3 pending enrolments per teen per hour (checked in the request RPC) to prevent spam.

### Frontend

- `src/pages/TeensCheckin.jsx`: add the "I'm a teen" branch. New sub-views: teen picker → waiting-for-approval (with 3s poll + expiry countdown) → set-PIN → done. If teen already has `self_pin_hash`, skip straight to PIN entry. Teen picker uses a new lightweight RPC `list_consented_teens_for_session(_qr_token uuid)` returning only `{ id, first_name, last_name, has_self_pin }` so the anon side never reads the full `teens` table.
- `src/pages/TeensAttendance.jsx`: new **Pending self-enrolments** panel (visible to admins + Teens unit members) with realtime subscription on `teen_self_enrolments`; each row shows teen name/photo, time requested, expiry, **Approve** / **Reject** buttons.

### Security

- Parent attendance consent still enforced in every RPC.
- Worker approval is scoped by `is_admin` OR `is_teens_unit_member` on the enrolment's tenant, verified inside SECURITY DEFINER RPCs.
- Self-PIN is bcrypt-hashed, never stored plaintext; PIN entry rate-limited by tracking failed attempts on the enrolment (5 failures → enrolment invalidated).
- Polling endpoint returns only status + expiry, no PII.
- All enrolment activity written to `audit_log` with `tenant_id`.

### Out of scope

- New teen self-registration (parent-registered only, per your answer).
- SMS/email OTP paths.
- Changing the existing parent magic-link or parent-PIN flows — both remain available.
