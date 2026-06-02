Remove the manual "Send wishes" button from the Upcoming Birthday dashboard widget.

### What
- Remove the admin-only "Send wishes" / "Sent" button that appears next to members whose birthday is today in the dashboard upcoming-birthday list.
- Clean up the associated state (`sending`, `justSent`), the `handleSend` callback, the settings/already-sent queries that only existed to support the manual button, and the unused imports (`Button`, `Send`, `Loader2`, `Check`).

### What stays
- Automatic scheduled birthday messages (cron-driven `send-birthday-messages` edge function) remain fully operational.
- The Birthday Messages settings page (templates, channels, enable toggle, send-time, test-to-me) stays untouched.
- The `BirthdayBanner` component stays.

### Files changed
- `src/components/dashboard/BirthdayCelebration.jsx`

### Implementation
1. In `UpcomingBirthdayItem`, strip out everything related to the manual send action:
   - Remove `sending`, `justSent` state.
   - Remove `isTenantAdmin` usage and `showAdminAction` flag.
   - Remove `settings` and `alreadySent` queries.
   - Remove `handleSend` callback.
   - Remove `canSend` conditional and the `<Button>` JSX block.
   - Remove unused imports (`Button`, `Send`, `Loader2`, `Check`, `useAuth`, `useQuery`).
   - Keep the avatar, name, and date display.

2. Verify no other components import `UpcomingBirthdayItem` and expect the manual-send behavior (the component simply renders member info; callers do not pass admin-specific props).