## Why menus aren't spotlighted

Tour steps target `[data-tour="…"]` selectors. Only the first step of each tour (`[data-tour="<module>-help"]`, rendered by `ModuleTour`) currently matches an element. Every other step's selector (`members-add`, `events-create`, `sidebar-nav`, `notification-bell`, `tenant-switcher`, `comms-announcement`, `pc-request`, `wsf-attendance`, `sn-folders`, `analytics-charts`, etc.) doesn't exist in the DOM, so `SpotlightOverlay` falls back to a centered modal with no highlight — exactly like on the screenshots.

My Family and Children Church work because their pages already carry every `data-tour` anchor the tour references. The other pages don't.

## Fix

Add the missing `data-tour="…"` attributes to the real UI elements referenced by `src/components/tour/tours.js`. No new tours, no logic changes.

### 1. Global chrome (once, in shared layout components)

| Selector | Where to add it |
|---|---|
| `sidebar-nav` | Sidebar nav container in `AppLayout.jsx` (or the `Sidebar` component it renders) |
| `notification-bell` | `NotificationBell.jsx` root button |
| `tenant-switcher` | Tenant switcher trigger in `AppLayout.jsx` header |
| `dashboard-feed` | Feed section wrapper in `MemberDashboard.jsx` / `Dashboard.jsx` |

### 2. Per-page anchors

For each page, add `data-tour` to the specific button/tab/section the step describes. Examples:

- **Members**: `members-add` on "Add member" button, `members-import` on "Import" button, `members-filters` on the filter bar, `members-table` on `MemberTable` root.
- **Events**: `events-create` on "New event" button, `events-list` on the events grid.
- **Attendance**: `attendance-create` on session create button, `attendance-checkin` on `CheckInPanel` root.
- **ChurchAttendance**: `ca-new-report`, `ca-trends`.
- **Follow-ups**: `followups-new`, `followups-referrals`, `followups-templates`.
- **Pastoral Care**: `pc-request`, `pc-assign`.
- **Communications**: `comms-announcement`, `comms-direct`, `comms-history` on the corresponding tabs/panels.
- **Transportation**: `transport-book`, `transport-drivers`.
- **Analytics**: `analytics-charts`, `analytics-absence`, `analytics-conversion`.
- **Exam Management**: `exam-sessions`, `exam-take`, `exam-results` on the relevant tabs.
- **Training Reports**: `training-attendees`.
- **WSF (Home Cell)**: `wsf-attendance`, `wsf-members`.
- **Sermon Notes**: `sn-folders`, `sn-new`.
- **Testimony**: `testimony-new`.
- **Unit Tasks**: `tasks-new`, `tasks-report`.
- **Inventory**: `inv-items`, `inv-inspections`.
- **Settings**: `settings-modules`, `settings-branding`, `settings-restart-tours`, `settings-danger` on the corresponding cards/sections.
- **Tenant Admin**: `ta-tenants`, `ta-billing`, `ta-integrations` on the tabs.
- **User Management**: `um-invite`, `um-roles`.
- **My Profile**: `profile-completion`, `profile-feed`, `my-certificates`.
- **Church Unit**: `unit-members`.
- **Reports**: no extra anchors needed (only 1 step).

### 3. Verification

After edits, run the app, open each module for the first time, and confirm the spotlight tracks the real UI element on every step. Steps whose target is legitimately hidden for the current role are already filtered out via `when`.

### Out of scope

- No changes to `TourProvider`, `SpotlightOverlay`, `HelpButton`, `useAutoTour`, `ModuleTour`, or `tours.js` content.
- No new tours, no copy rewrites, no business-logic changes.

### Files touched

- `src/components/AppLayout.jsx` (sidebar-nav, tenant-switcher wrappers)
- `src/components/notifications/NotificationBell.jsx`
- `src/components/dashboard/MemberDashboard.jsx` (dashboard-feed)
- The 20+ module pages and their child components listed above.
