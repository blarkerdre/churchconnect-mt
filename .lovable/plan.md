## Goal
Restrict follow-up reassignment (and other follow-up admin controls on the list page) to admins and actual Follow-up team members, not every unit leader.

## Root cause
- `FollowupDetailPanel` shows the **Reassign** button when `isAdmin || isUnitLeader`.
- `isUnitLeader` from `useAuth` is true for **any** unit leader (it just checks the `unit_leader` role globally).
- Loveth Osho is a unit leader for "Evangelism", so she qualifies even though she isn't on the Follow-up team. The candidate list is already correctly limited to the Follow-up team — only the gate is wrong.

## Changes

### 1. `src/pages/Followups.jsx`
- Compute `const isFollowupTeam = !!user?.id && followupUnitMembers.includes(user.id);`
- New derived flag `const canManageFollowups = isAdmin || isFollowupTeam;`
- Replace the two `(isAdmin || isUnitLeader)` gates (filters block at ~line 312 and report/CSV/print buttons at ~line 327) with `canManageFollowups`.
- Pass `canManage={canManageFollowups}` to `<FollowupDetailPanel>` (keep existing `isAdmin` / `isUnitLeader` props for any other internal uses, or drop `isUnitLeader` if unused).

### 2. `src/components/followups/FollowupDetailPanel.jsx`
- Accept a new prop `canManage` (default `false`).
- Change the Reassign visibility gate from `(isAdmin || isUnitLeader) && followup.status !== "Completed"` to `canManage && followup.status !== "Completed"`.
- Leave the existing Save/Status/etc. logic alone unless it also uses `isUnitLeader` incorrectly — only Reassign is in scope here.

## Out of scope
- RLS policies (admins/follow-up team can already write per existing rules).
- Other pages that read `isUnitLeader`.
- Re-architecting role checks; we keep `isUnitLeader` as-is for the wider app.
