## Why Romoke can't see it

Her user has `member` + `wsf_leader` roles, and no `unit_leader_assignments` row for Teens Church — even though `members.church_unit` lists "Teens Church". The sidebar gate in `src/components/AppLayout.jsx` (line 155) only allows Admins, Reports Officer, or Unit Leaders whose leader unit matches `/teen|youth/i`. Regular Teens Church unit members are excluded from the nav, even though the page already supports them (create + close sessions).

## Fix

Widen the `teens` nav gate in `src/components/AppLayout.jsx` — mirror the pattern used for `children_church` (line 154).

1. Add `const { isMemberOfUnit: isTeensChurchMember } = useUnitMembership("Teens Church");` alongside the other `useUnitMembership` calls (~line 138).
2. Update the `teens` branch on line 155 to:
   ```js
   if (item.access === "teens") return isAdmin || isTeensChurchMember || (isUnitLeader && (leaderUnits || []).some(u => /teen|youth/i.test(u))) || isReportsOfficer;
   ```

No page-level changes needed — `TeensAttendance.jsx` already restricts edit/delete/reporting to leaders/admins, so members will only see create + close actions.
