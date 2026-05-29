# Sound alert when a user receives messages and announcements

## Current state
- **Bell notifications** (table `notifications`): already wired. `NotificationBell.jsx` subscribes to `postgres_changes` INSERT and calls `triggerNotificationAlert(...)` (sound + vibration + browser notification). Works after the unlock + Test Sound improvements just shipped.
- **Direct messages** (table `messages`, used by `MessagingPane.jsx`): polled via react-query, **no realtime subscription, no sound**. User receives nothing audible.
- **Announcements** (table `announcements`): also no per-recipient notification rows and no sound.

## Changes

### 1. New hook `src/hooks/useMessageAlerts.jsx`
- Subscribes to two realtime channels for the signed-in user / current tenant:
  - `messages` INSERT filtered by `recipient_id=eq.${user.id}`. Verify `tenant_id === currentTenantId`; ignore own sends (`sender_id === user.id`).
  - `announcements` INSERT filtered by `tenant_id=eq.${tenantId}`. Skip the announcement's `created_by` (sender). RLS already filters audience, so anything that comes through is something this user can see.
- For each event:
  - Fetch the sender display name (single row from `members` by `user_id`, cached) so the alert says e.g. *"New message from Jane Doe"*.
  - Call `triggerNotificationAlert(title, preview)`.
  - Invalidate the relevant react-query key (`["messages", …]` or `["announcements", …]`) so the inbox/feed updates without a refresh.
- Clean up channels on unmount / tenant switch.

### 2. Mount the hook globally
- Call `useMessageAlerts()` once inside `src/components/AppLayout.jsx` (right alongside the existing notification logic) so every authenticated screen receives the alerts.

### 3. No changes needed to `notification-alert.js`
- Sound playback, unlock, and Test Sound are already in place.

## Out of scope
- Per-recipient announcement fan-out into the `notifications` table (would be a larger change and duplicates data).
- Push notifications for messages when the tab is closed (would require an Edge Function + Web Push payload — separate feature).
- WhatsApp/SMS/email side channels (already handled elsewhere).

## How we'll verify
Open the app in two browsers signed in as two members of the same tenant. From one, send a direct message and post an announcement. The other should:
- Hear the chime,
- See the inbox / announcement feed update immediately without refresh,
- See the browser notification banner if permission was granted.
