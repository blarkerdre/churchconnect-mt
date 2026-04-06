

## In-App Notification Sound + Vibration on New Notifications

### Problem
When a new notification arrives, the bell icon updates silently. On mobile, users miss notifications because there's no audio or haptic feedback.

### Approach
Use the **Web Audio API** (or a short audio file) and the **Vibration API** (`navigator.vibrate()`) to alert users when a new real-time notification is received. Also request **browser notification permission** to show a native OS notification (which includes sound on most devices).

This does NOT require a push notification server — it works while the app is open/in foreground using the existing real-time subscription.

### Changes

#### 1. New utility: `src/lib/notification-alert.js`
- Play a short notification sound using a bundled audio file (a small MP3/WAV in `public/sounds/notification.mp3`)
- Trigger `navigator.vibrate([200, 100, 200])` on supported devices
- Show a browser `Notification` popup (if permission granted) with the notification title and message

#### 2. Update `src/components/notifications/NotificationBell.jsx`
- On mount, request `Notification.requestPermission()` once (if not already granted)
- In the real-time `INSERT` handler (line 78-81), after invalidating queries:
  - Call the alert utility to play sound + vibrate + show browser notification
  - Pass `payload.new.title` and `payload.new.message` for the browser notification content

#### 3. New asset: `public/sounds/notification.mp3`
- A short, pleasant notification chime (will generate a small audio file)

### Technical details
- `navigator.vibrate()` works on Android Chrome and most mobile browsers; iOS Safari ignores it (no support), but the sound and browser notification still work
- Browser notifications require HTTPS (which the PWA already uses) and user permission
- Sound playback requires a prior user interaction on most browsers — the permission request dialog counts as interaction
- All three alerts (sound, vibration, browser notification) gracefully degrade if unsupported

### Files changed
- **New**: `public/sounds/notification.mp3` — short notification chime
- **New**: `src/lib/notification-alert.js` — playSound + vibrate + showBrowserNotification
- `src/components/notifications/NotificationBell.jsx` — request permission on mount, trigger alerts on new notification

