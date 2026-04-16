

## Unit Leader Read-Only Member View + Feedback for Leaders

### Overview
Two changes: (1) Unit leaders can view members assigned to their unit(s) in read-only mode, and (2) both Unit leaders and Home Cell leaders can rate the app via the feedback dialog.

### Changes

**1. `src/pages/Members.jsx` — Read-only unit member viewing**
- Currently, unit leaders who are not admins don't see the Members page (or see limited data). The `church_unit` field on members is a comma-separated text field matching unit names.
- Add logic: if user `isUnitLeader && !isAdmin`, show the members list filtered to only members whose `church_unit` contains one of the leader's `leaderUnits`, in read-only mode (no edit/delete buttons, no add member button).
- This mirrors the Home Cell leader pattern — view-only access to their assigned members.

**2. `src/components/dashboard/WSFLeaderDashboard.jsx` — Add feedback prompt**
- Import `AppFeedbackDialog` and add the same "Rate this app" card + dialog that `MemberDashboard` already has.
- This covers Home Cell leaders (who see `WSFLeaderDashboard`).

**3. `src/components/dashboard/MemberDashboard.jsx` — Already has feedback**
- Unit leaders who are NOT also WSF leaders already fall through to `MemberDashboard` (line 95-96 in Dashboard.jsx), which already has the feedback dialog. No change needed for unit leaders.

**4. `src/components/AppLayout.jsx` — Add Members nav for unit leaders**
- Check if the Members nav item is already visible to unit leaders. If not, add it so they can navigate there.

### Files Changed
- `src/pages/Members.jsx` — add read-only filtered view for unit leaders
- `src/components/dashboard/WSFLeaderDashboard.jsx` — add feedback card and dialog
- `src/components/AppLayout.jsx` — ensure Members nav visible to unit leaders (if needed)

