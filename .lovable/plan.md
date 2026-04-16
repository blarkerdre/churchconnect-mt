
The user wants the welcome banner in `MemberDashboard.jsx` to display the user's role and the unit(s) they lead.

Looking at the current welcome banner (lines 91-122 in MemberDashboard.jsx):
- It shows the role badge (`roleLabel`) already
- It shows membership status, church_unit, and WSF centre
- Missing: explicit "leads X unit" indicator for unit leaders / Home Cell leaders

From `useAuth`, available data: `isUnitLeader`, `isWSFLeader`, `leaderUnits` (array of unit names). For Home Cell leaders, we'd need centre names — but we already query led centres in WSFLeaderDashboard via `wsf_leaders`. For MemberDashboard, the simplest approach is to show `leaderUnits` for unit leaders, and for Home Cell leaders show a "Home Cell Leader" indicator with centre names if easily accessible.

## Plan: Show Role + Led Units in Welcome Banner

### Change
**`src/components/dashboard/MemberDashboard.jsx`** — enhance welcome banner badges row:

1. For **unit leaders**: add a badge "Leads: [unit names]" showing comma-separated `leaderUnits` from `useAuth`.
2. For **Home Cell leaders**: add a query to fetch centre names from `wsf_centres` where the user is `leader_user_id`, then show "Home Cell Leader: [centre names]".
3. Keep the existing `roleLabel` badge in the title row.

### Layout
Below existing status/unit badges, add a new line (only if leader):
```
[Leads Choir, Ushers]   [Home Cell Leader: Cardiff Centre]
```
Styled as accent badges to stand out.

### Files Changed
- `src/components/dashboard/MemberDashboard.jsx` — add Home Cell centres query + render leader badges (~15 lines)
