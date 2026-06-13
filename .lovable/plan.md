## Plan

The check-in backend path is now accepting your Children Church permissions, but the UI currently depends on the selected child list staying available after the RPC returns. If that list refreshes/changes at the wrong moment, the check-in can complete without visibly showing the generated PIN.

### Changes
1. Update the Children Church check-in button flow to:
   - Generate one PIN for the selected children.
   - Keep a stable snapshot of the selected children before making the backend calls.
   - Show the PIN from that snapshot immediately after success.

2. Improve error visibility on check-in:
   - Show a clear message if the backend rejects the check-in.
   - Log the detailed backend error to the console for diagnosis.

3. Prevent confusing duplicate check-ins:
   - Before inserting a new check-in, update the backend `checkin_child` function to reject a child who is already currently checked in, with a clear “already checked in” message.

### Technical details
- Frontend file: `src/pages/ChildrenChurch.jsx`
- Backend migration: redefine `public.checkin_child(...)` with an existing-active-check-in guard.
- No changes to the children registration schema or pickup rules.