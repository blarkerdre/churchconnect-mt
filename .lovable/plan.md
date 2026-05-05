## Goal
Members should only see and self check-in to **Unit Meetings for units they belong to**. All other session types (Sunday Service, Bible Study, etc.) will no longer appear in the member self check-in widget or QR self check-in page.

Admin/leader-driven check-in (`CheckInPanel.jsx`) is unchanged — admins continue to manage attendance for all session types.

## Changes

### 1. `src/components/attendance/SelfCheckInWidget.jsx`
Tighten the eligibility filter so it returns only Unit Meetings the member belongs to:
```js
const eligibleSessions = sessions.filter((s) => {
  if (s.session_type !== "Unit Meeting" || !s.unit) return false;
  return myUnitsLower.includes(s.unit.toLowerCase());
});
```
Non-unit sessions are dropped entirely. Unit filter dropdown behavior is preserved.

### 2. `src/components/attendance/SelfCheckIn.jsx` (QR/direct check-in page)
Update the eligibility guard so any non-Unit-Meeting session shows the "not eligible" message and hides the check-in button. Only Unit Meetings matching the member's units pass.

### 3. RLS hardening — update `member_eligible_for_session` SQL function
Currently the function returns `true` for non-Unit-Meeting sessions for self check-ins. Change it to:
- Unit Meeting + member belongs to that unit → allowed
- Anything else (non-Unit-Meeting, or wrong unit) → denied

This blocks self check-ins to Sunday Service / Bible Study at the database layer. Admin manual check-ins are unaffected because they use the separate "Admins can manage attendance" policy, not "Members can self check-in".

## Out of scope
- `CheckInPanel.jsx` (admin tool) — unchanged
- Reporting / CSV exports — unchanged
- No data cleanup needed

Approve to implement.