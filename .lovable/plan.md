Hide the "Test sound" button in the notification bell popover from everyone except Super Admin and tenant owners.

### Change
In `src/components/notifications/NotificationBell.jsx`, wrap the "Test sound" button with a conditional check:
- Show it only when the current user is a `super_admin` (app-level role) OR a tenant `owner`.
- Regular admins and members should not see it.

### Technical details
- `useAuth` already exposes `roles` (array) and `isTenantOwner` (boolean).
- Condition: `isTenantOwner || roles.includes("super_admin")`
- The button is located in the popover header, next to "Mark all read".