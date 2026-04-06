

## Route Announcement Notifications to Communications Page

### Problem
When clicking "View" on an announcement notification, it navigates to `/` (Dashboard) instead of the Communications page with the Announcements tab selected.

### Solution
Update the `referenceRoutes` map in `NotificationBell.jsx` to point `announcement` to `/communications` instead of `/`.

### Change

#### `src/components/notifications/NotificationBell.jsx` (line 37)
```js
// Before
announcement: "/",

// After
announcement: "/communications",
```

### Files changed
- `src/components/notifications/NotificationBell.jsx` — change announcement route to `/communications`

