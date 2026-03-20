

## Show User Role on Dashboard and Header

### Problem
The user's role (e.g., "Admin", "Unit Leader", "Member") is only visible inside the sidebar, which is hidden by default on mobile. On a 384px viewport, users never see their role unless they open the sidebar.

### Solution
Display the user's role in two places:

1. **Header bar** — Show the user's name and role badge next to the notification bell on mobile, so it's always visible.

2. **Member Dashboard welcome banner** — Add a role badge (e.g., "Member", "Unit Leader") below the user's name in the welcome card.

### Changes

**`src/components/AppLayout.jsx`**
- Add the user's role title as a small badge/text in the sticky header, visible on all screen sizes
- Use the existing `getRoleTitle()` function to determine the display text

**`src/components/dashboard/MemberDashboard.jsx`**
- No changes needed here since the role will be visible in the header

### Technical Detail
- Reuse the `getRoleTitle()` logic already in AppLayout
- Show as a subtle badge or text next to the page title or notification bell
- Keep it compact for mobile: just a small role label

