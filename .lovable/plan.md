
## Goal

On `/teens/checkin/:token`, replace the single "Check in / out" toggle with a state-aware button per teen: show **Check in** (primary) when the teen has no open attendance record for this session, and **Check out** (destructive/amber) when they already have an open one. Behavior on click is unchanged — it still calls the existing `teen_checkin` / `teen_self_checkin` RPCs, which toggle server-side.

## Current state (verified)

- `src/pages/TeensCheckin.jsx` renders a single button labeled "Check in / out" in three places (guardian list tile at ~line 478, guardian PIN dialog at ~line 344, self-checkin PIN at ~line 394/526).
- The RPC toggles based on the last `teen_attendance_records` row and returns `action: "checked_in" | "checked_out" | "already_checked_out"`, but the page has no pre-click knowledge of state.
- The public self-list comes from `list_consented_teens_for_session`; guardians read `teens` directly. Neither surfaces "currently checked in".

## Changes

### 1. New SECURITY DEFINER RPC (migration)

`public.get_teen_open_checkins(_qr_token uuid)` → returns `teen_id uuid[]` (or setof teen_id) of teens with an open record (`checked_out_at IS NULL`) for the session bound to that token. Grantable to `anon` + `authenticated` since the QR token already gates the page.

### 2. `src/pages/TeensCheckin.jsx`

- After loading the session (and after every successful `doCheckin` / `doSelfCheckin`), call the new RPC and store `openIds` as a `Set` in state.
- Add a helper `isCheckedIn(teenId)` and a small `<ActionButton>` that renders:
  - "Check in" (default primary) when not in `openIds`
  - "Check out" (variant `destructive` or amber) when in `openIds`
- Apply it to:
  - Guardian teen list tiles (currently a single tile button — add a small right-aligned pill/button next to the name and keep the row tap for the same action, or split into name + action button).
  - Guardian PIN confirm dialog button.
  - Self-checkin PIN confirm button and the "Save PIN & check in" button (that one stays "Save PIN & check in" since it's always a fresh enrolment).
- Update the copy at line 451 from "Tap the teen to check in / out." to "Tap a teen to check in, or check out if they're already signed in."

No backend behavior change — RPCs stay toggling; the UI only reflects state.

## Out of scope

- Changing how attendance records are created/closed.
- Any change to the worker/admin views (`TeensAttendance.jsx`).
