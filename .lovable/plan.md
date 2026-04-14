

## Add Home Cell Centre Assignments to User Management

### Problem
Admins can already assign the "Unit Leader" and "Home Cell Leader" roles via checkboxes in User Management. Unit leaders also get an inline widget (`UnitLeaderAssignments`) to assign specific church units directly from the user table. However, Home Cell (WSF) leaders have no equivalent — their centre assignment is buried in Settings > Home Cell Centres. This makes it inconsistent and harder to manage.

### Solution
Create a `WSFLeaderAssignments` component (mirroring `UnitLeaderAssignments`) that shows which Home Cell centres a WSF leader is assigned to, with inline add/remove capability. Display it in the User Management table alongside the existing "Led Units" column.

### Technical Details

**New Component: `src/components/users/WSFLeaderAssignments.jsx`**
- Fetches the user's linked member record to get `member.id`
- Queries `wsf_centres` where `leader_id = member.id` (scoped to tenant)
- Shows assigned centres as badges with remove (X) buttons
- Popover with available (unassigned) centres to add
- On add: updates `wsf_centres.leader_id` to the member's ID
- On remove: sets `wsf_centres.leader_id` to null

**Edit: `src/pages/UserManagement.jsx`**
- Import `WSFLeaderAssignments`
- In the "Led Units" column, also show `WSFLeaderAssignments` for users with the `wsf_leader` role
- Rename column header from "Led Units" to "Assignments" to cover both unit and centre assignments

### Files Changed
- **New**: `src/components/users/WSFLeaderAssignments.jsx`
- **Edit**: `src/pages/UserManagement.jsx` — show WSF centre assignments inline

