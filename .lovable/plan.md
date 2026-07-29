## Goal

Add a **Preteens** attendance feature that is a full clone of Teens attendance, with its own registration records, but managed by the **Children's Church** unit (leaders and workers), not a new unit.

## Data model (new tables, mirroring the teens set)

- `preteens` — parent-registered preteen: primary guardian member, name, optional DOB (parent decides the age band — no enforced range), gender, photo, notes, `is_active`, access PIN hash, self PIN hash, `attendance_consent` (+ date/by), `data_processing_consent` (+ date/by, mandatory as with teens).
- `preteen_attendance_sessions` — title (service-type dropdown from settings), session type, notes, date, start/end time, late-after, status, QR token, created_by.
- `preteen_attendance_records` — session, preteen, status, checked in/out at + by, duration, source.
- `preteen_self_enrolments` — self check-in requests awaiting worker approval, with expiry and failed-attempt counter.

All tables tenant-scoped with `tenant_id`, GRANTs, RLS, and `updated_at` triggers, following the teens policies exactly but swapping the role helpers to `is_children_church_leader` / `is_children_church_member` (admins and reports officers keep read access; parents see only their own preteens).

## Database functions (clones of the teens RPCs)

`get_preteen_session_by_token`, `list_open_preteen_sessions`, `get_preteen_open_checkins`, `list_consented_preteens_for_session`, `preteen_checkin`, `preteen_self_request_enrolment`, `preteen_self_check_enrolment`, `preteen_self_set_pin`, `preteen_self_checkin`, `preteen_self_approve`, `preteen_self_reject`, plus the session-update restriction trigger. Check-in/out inserts the same **in-app notification** to the parent/guardian (no SMS/email).

## Frontend

- `src/pages/PreteensAttendance.jsx` — sessions list, create/edit/close/reopen (leaders full control; Children's Church workers can create and close), roster with manual sign-in/out, single-session report, cumulative report with filters + CSV, registered preteens directory, consent badges for leaders, worker names on records.
- `src/pages/PreteensCheckin.jsx` and `PreteensCheckinLanding.jsx` — QR scan flow: consent-required messaging, separate Check in / Check out buttons based on current status, duplicate prevention, self check-in with one-time verification, random funny welcome / see-you-next-time image, manual Close button.
- `src/components/preteens/PreteenAttendanceQRDialog.jsx` and `PreteensPersistentQRDialog.jsx` — per-session and single persistent QR (link live only while a session is open).
- `src/components/preteens/PreteensSection.jsx` — registration inside **My Family**, with mandatory consents and the same authorised-adult rules.
- `src/hooks/usePreteensUnitRole.jsx` — wraps the Children's Church leader/member checks for this module.

## Routing & navigation

- Routes: `/t/:tenantSlug/preteens-attendance`, `/t/:tenantSlug/preteens/checkin`, `/t/:tenantSlug/preteens/checkin/:token` (public check-in routes, same as teens).
- Sidebar entry "Preteens Attendance" visible to admins, reports officers, and Children's Church leaders/members; My Family gains a Preteens section alongside Children and Teenagers.

## Technical notes

- Delivered as one migration for tables/policies/functions, then the frontend files.
- The "promote to teenager" path in My Family stays as-is; a child → preteen → teen progression is not added unless you want it.
- All queries carry explicit `.eq("tenant_id", tenantId)` guards per project convention.
