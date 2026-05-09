## Problem

When an admin creates an attendance session (e.g. Sunday Service, Home Cell Meeting, or a Unit Meeting), members don't see it on their dashboard. The "Today's Attendance" widget on the member dashboard only surfaces **Unit Meetings whose `unit` matches one of the member's `church_unit` values**. Everything else — Sunday Service, Bible School, Home Cell, Special Service, Other — is silently filtered out, so members think nothing was created.

RLS already allows any authenticated tenant member to `SELECT` from `attendance_sessions`, so this is purely a UI-eligibility bug in `SelfCheckInWidget.jsx`.

## Fix

Broaden eligibility in `src/components/attendance/SelfCheckInWidget.jsx` so members see every session created for today that is relevant to them:

1. **Sunday Service / Special Service / Bible School / Other (no `unit` set)** → visible to every member of the tenant.
2. **Unit Meeting** → visible only to members whose `church_unit` includes the session's `unit` (current behaviour).
3. **Home Cell Meeting** → visible to members assigned to that Home Cell centre. Look up the member's centre membership via `wsf_centre_members` (the existing Home Cell member table) and match against `session.unit` (which stores the centre name) case-insensitively.
4. Keep the unit/centre filter dropdown, but build it from the new wider eligible set.
5. Empty state: instead of `return null` when there are no eligible sessions, render a small "No meetings open for check-in today" message inside the card so members know the widget is working.

No DB or RLS changes needed. Behaviour for admin-side check-in (`CheckInPanel`) and `MyProfile → Recent Attendance` is unchanged.

## Files to touch

- `src/components/attendance/SelfCheckInWidget.jsx` — add Home Cell membership query, broaden `eligibleSessions` filter, add empty-state message.

## Out of scope

- Changing RLS, session creation flow, or admin check-in panel.
- Adding push/email notifications when a session opens (separate request).
