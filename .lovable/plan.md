

## Add PWA Push Notification Support

### Problem
Currently, notification alerts (sound, vibration, browser Notification API) only work while the app tab is in the foreground. When users install the PWA and the app is in the background or closed, they receive no alerts because there is no service worker handling push notifications.

### Approach
Register a lightweight service worker that listens for `push` events and displays native OS notifications with sound/vibration. This works even when the app is closed or in the background on mobile devices.

No `vite-plugin-pwa` needed — the app already has a `manifest.json` with `display: "standalone"`. We just need a service worker for push event handling and to register it from the app.

### Changes

#### 1. New: `public/sw.js` — Service Worker
- Listen for `push` events and display notifications using `self.registration.showNotification()`
- Listen for `notificationclick` to open/focus the app
- Keep it minimal — no caching/offline support (avoids stale content issues)

#### 2. Update: `src/lib/notification-alert.js` — Register SW + enhance notifications
- Add `registerServiceWorker()` function that registers `/sw.js` only when:
  - Not in an iframe (prevents preview issues)
  - Not on a Lovable preview host
  - `serviceWorker` is supported
- Update `showBrowserNotification()` to use the service worker registration's `showNotification()` when available (this works in background, unlike `new Notification()`)
- Keep the existing `new Notification()` as fallback

#### 3. Update: `src/components/notifications/NotificationBell.jsx`
- Call `registerServiceWorker()` on mount alongside `requestNotificationPermission()`

### Technical Details
- Service worker `showNotification()` works even when the app is backgrounded on mobile — regular `new Notification()` does not
- The SW includes `vibrate` and a tag to prevent duplicate notifications
- Clicking the notification opens/focuses the app window
- No caching strategies — avoids stale content in preview
- Registration is guarded against iframe/preview contexts per PWA guidelines

### Files changed
- **New**: `public/sw.js`
- `src/lib/notification-alert.js`
- `src/components/notifications/NotificationBell.jsx`

