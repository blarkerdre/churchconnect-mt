

## Add Full Notification Detail View

### Problem
Currently, clicking a notification only marks it as read. The notification's `message` is truncated to 2 lines (`line-clamp-2`), and there's no way to read the full content or navigate to the related item (event, announcement, follow-up, pastoral care request, etc.).

### Solution
Add a detail dialog that opens when a notification is clicked, showing the full message and a "View" button that navigates to the relevant page based on `reference_type`.

### Changes

#### 1. `src/components/notifications/NotificationBell.jsx`
- Add a `NotificationDetailDialog` component using the existing Dialog primitive
- When a notification row is clicked, open the dialog showing:
  - Full title and message (no truncation)
  - Notification type badge and timestamp
  - "Go to [item]" button that navigates based on `reference_type`:
    - `event` → `/events`
    - `announcement` → dashboard (feed)
    - `followup` → `/followups`
    - `pastoral_care` → `/pastoral-care`
    - `transport` → `/transportation`
    - `meeting` → `/wsf`
    - Default → close dialog
  - "Mark as read" + "Delete" actions in the dialog footer
- Auto-mark the notification as read when the dialog opens
- Use `useNavigate` from react-router-dom for navigation; close popover + dialog on navigate

### Files changed
- `src/components/notifications/NotificationBell.jsx` — add detail dialog with full message view and navigation

