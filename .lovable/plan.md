## Fix Self Check-In Eligibility + Add Unit Filter

### 1. `SelfCheckInWidget.jsx` (Dashboard "Today's Attendance")
- Fetch member's `church_unit` alongside name.
- Also fetch `unit` field on sessions.
- Filter rendered sessions: for `session_type === "Unit Meeting"`, only show if `member.church_unit` (comma-split, trimmed, case-insensitive) includes `session.unit`. Non-unit sessions remain visible to all.
- Add a unit filter dropdown above the list (populated from the member's units + "All"). Defaults to "All". Useful for members in multiple units.

### 2. `SelfCheckIn.jsx` (QR / direct self check-in page)
- Add a defensive eligibility guard: if `session.session_type === "Unit Meeting"` and member is not in `session.unit`, show a "Not eligible for this unit meeting" message instead of the check-in button.

### 3. Data Cleanup
Delete the two stray Kelechi records via the insert tool:
- `e4f79b40-2882-4691-ac12-ecd8a96abbdc`
- `70b05caa-7f7c-478f-a738-367fb65662f5`

### 4. RLS Hardening
Update the "Members can self check-in" policy on `attendance_records` so INSERT requires: for Unit Meeting sessions, the inserting member's `church_unit` must contain the session's `unit` (case-insensitive substring/array match). Implement via a `SECURITY DEFINER` helper `public.member_eligible_for_session(member_id, session_id)` to keep the policy clean and avoid recursion.

### Technical Notes
- Unit comparison normalizes whitespace and lowercases on both sides.
- Helper returns true for non-Unit-Meeting sessions automatically.
- No schema changes beyond the new function + policy update.

Approve to implement.