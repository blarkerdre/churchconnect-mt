

## Allow Home Cell Leaders to View Their Centre Members (Read-Only)

### Problem
Home Cell leaders have a "Manage Members" quick action on their dashboard, but it navigates to `/wsf` which only shows attendance. The actual member management dialog (`WSFCentreMembersDialog`) is only available in Settings (admin-only). Leaders cannot see who is in their centre.

### Solution
Add a read-only member list to the WSF Management page for Home Cell leaders, while keeping add/remove capabilities admin-only.

### Changes

**1. `src/components/wsf/WSFCentreMembersDialog.jsx`**
- Accept an `isReadOnly` prop (default `false`)
- When `isReadOnly` is true: hide the "Add" button, hide the remove (UserMinus) button on each member row
- Show phone number alongside email for leader visibility

**2. `src/pages/WSFManagement.jsx`**
- Import `WSFCentreMembersDialog`
- For WSF leaders (non-admin), add a "Members" section below attendance showing their led centres as cards with member count
- Clicking a centre card opens `WSFCentreMembersDialog` with `isReadOnly={true}`
- Admins continue to manage members via Settings as before

**3. `src/components/dashboard/WSFLeaderDashboard.jsx`**
- Update the "Manage Members" quick action label to "View Members" to reflect the read-only nature

### Files Changed
- `src/components/wsf/WSFCentreMembersDialog.jsx` — add `isReadOnly` prop to hide add/remove controls
- `src/pages/WSFManagement.jsx` — add centre member cards with view dialog for leaders
- `src/components/dashboard/WSFLeaderDashboard.jsx` — rename quick action label

