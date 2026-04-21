

## Unit Leader: Add and Delete Attendance Before Session Closes

### Problem
On the **Attendance** page, the "Check-ins" card is read-only. Unit leaders can create a meeting and view who has checked in, but there is no UI to **add** a member to the attendance list or **remove** an erroneous check-in. They can only close the meeting.

The capability already exists in code: `src/components/attendance/CheckInPanel.jsx` provides exactly the tap-to-add / tap-to-remove behavior we need, scoped to the session's unit. It just isn't mounted anywhere.

RLS is already correct — the policies `Unit leaders can manage unit session records` and `Admins can manage all records` already permit INSERT and DELETE on `attendance_records` for the leader's own unit sessions, so **no database changes are needed**.

### Fix (single page: `src/pages/Attendance.jsx`)

1. **Add a "Manage Attendance" button** next to the existing "Close Meeting" button in the action bar. It is visible only when:
   - `canManage` is true (admin, unit leader, or Home Cell leader), AND
   - a session is selected, AND
   - the session is **not closed** (`!isClosed`).

2. **Open `CheckInPanel` in a Dialog** when the button is clicked. `CheckInPanel` already:
   - Lists eligible members (filtered by the session's unit for Unit Meetings).
   - Provides a search box.
   - Toggles a member on/off with a single tap (insert if not checked-in, delete if already checked-in).
   - Auto-invalidates the `attendance-records` query so the read-only Check-ins card updates instantly.

3. **Hide the panel when the session is closed.** The existing `Close Meeting` flow remains the gate: once closed, the Manage button disappears and the read-only view is the only thing left, matching the current "no edits after close" rule.

### UI Detail

Action bar (when session is Open):
```text
[ Download ] [ Print ] [ Manage Attendance ] [ Close Meeting ] [ + New Meeting ]
```

Dialog content: `<CheckInPanel session={selectedSession} onClose={() => setManageOpen(false)} />` rendered inside a `Dialog` / `DialogContent` with `max-w-lg` and `max-h-[90vh] overflow-y-auto` so it works at 384 px width.

### Why this works for all leader types
- **Unit leader** opening a Unit Meeting they own → RLS `Unit leaders can manage unit session records` permits insert/delete. `CheckInPanel` filters the member list to that unit.
- **Home Cell leader** opening a Home Cell Meeting they own → RLS `WSF leaders can manage WSF session records` permits insert/delete. `CheckInPanel` shows all members (Home Cell meetings are not unit-filtered) which matches existing behavior.
- **Admin** → full access via `Admins can manage all records`.

### Out of scope
- No DB / RLS changes.
- No changes to `CheckInPanel.jsx` (it already does exactly what we need).
- No changes to the close-session flow or the post-close report card.
- No changes to the "Members can self check-in" path (`SelfCheckIn.jsx`).

### Mobile (384 px)
Action bar already wraps via `flex-wrap`. The Manage Attendance button uses the same `<span className="hidden sm:inline">` pattern as Download/Close so only the icon shows on narrow screens. The Dialog uses `max-w-[95vw] sm:max-w-lg` to fit the viewport.

### Verification
1. Sign in as a unit leader, open an existing **Open** Unit Meeting for your unit.
2. Click **Manage Attendance** → dialog lists members of that unit.
3. Tap a member → green check appears, Check-ins card updates, "Checked In" stat increments.
4. Tap the same member again → check is removed, count decrements.
5. Close the meeting → Manage Attendance button disappears; read-only view remains.
6. Confirm an admin sees the same button on every session type, and a non-leader/non-admin user sees no Manage button.

