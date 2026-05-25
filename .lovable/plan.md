
## Goal
When a member receives a notification, their phone should sound, vibrate, and show a banner — both while the app is open and when it is closed/backgrounded (installed PWA on Android, and installed PWA on iOS 16.4+).

## Part A — Improve in-app alert (works today, sharpen it)

`src/lib/notification-alert.js` already plays sound + vibrates + shows a browser notification. Issues to fix:
1. **Mobile autoplay**: browsers block audio until the user has interacted with the page. Add a one-time "unlock" on first tap/click that primes the `Audio` element so subsequent realtime notifications play reliably.
2. **Louder/longer chime**: replace `/public/sounds/notification.mp3` with a more attention-grabbing chime (~1.5–2s, two-tone). Bump `audio.volume` to 1.0.
3. **Repeat playback**: if the document is hidden, play the chime twice with a 600ms gap and use a stronger vibration pattern `[300,150,300,150,500]`.
4. **Permission prompt UX**: today `requestNotificationPermission()` fires immediately on mount which iOS ignores. Move the prompt behind a small one-time "Enable alerts" toast/button in `NotificationBell` so it's user-initiated (required by iOS).

Files: `src/lib/notification-alert.js`, `src/components/notifications/NotificationBell.jsx`, replace `public/sounds/notification.mp3`.

## Part B — Web Push for background delivery

### B1. Subscription storage
New table `push_subscriptions`:
- `user_id`, `tenant_id`, `endpoint` (unique), `p256dh`, `auth`, `user_agent`, timestamps.
- RLS: user can insert/select/delete their own rows; service role full access.

### B2. VAPID keys
Generate a VAPID key pair once and store as project secrets:
- `VAPID_PUBLIC_KEY` (also exposed to the client via a small `get-vapid-key` edge function or as a public env var)
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (e.g. `mailto:admin@churchmanagementsuite.org`)

### B3. Service worker push handler
Extend `public/sw.js` with:
```js
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(self.registration.showNotification(data.title || 'Notification', {
    body: data.message || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [300,150,300,150,500],
    tag: data.tag || 'app-notification',
    data: { url: data.url || '/' },
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});
```

### B4. Client subscribe flow
In `NotificationBell` (or a new `usePushSubscription` hook):
1. After SW is registered and user grants permission, call `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY })`.
2. UPSERT the subscription into `push_subscriptions` (scoped to current `user_id` + `tenant_id`).
3. Skip in preview/iframe (existing guards in `notification-alert.js`).

### B5. Delivery edge function `send-push`
- Triggered for each row inserted into `public.notifications`.
- Uses `npm:web-push@3` with the VAPID keys.
- Looks up all `push_subscriptions` for `user_id` + `tenant_id`, sends payload `{ title, message, url, tag }`.
- Removes any subscription that returns 404/410 (expired).

### B6. DB trigger
After-insert trigger on `public.notifications` calls `send-push` via `net.http_post`, using existing `supabase_url` + `email_queue_service_role_key` vault secrets (same pattern as `notify_pastoral_care_new_request`). Payload: `{ notification_id }`. The function loads the row itself to avoid leaking PII in the trigger body.

## Out of scope
- Native Capacitor APNs/FCM. (Web Push covers Android Chrome/Firefox and iOS 16.4+ installed PWAs, which matches the project's current "installable PWA" approach.)
- Per-channel preferences/quiet hours.
- Backfilling subscriptions for users who never visit again after this ships.

## Technical notes
- iOS push **requires the app be installed to the home screen** and permission must be requested from a user gesture. Document this in `InstallAppDialog`.
- Service worker is intentionally skipped in iframe/preview hosts — Web Push will only activate on the real domain (`app.churchmanagementsuite.org` / published URL).
- `web-push` npm package works in Deno via `npm:web-push@3`.

## Files
**New**
- `supabase/functions/send-push/index.ts`
- `src/hooks/usePushSubscription.js`

**Edited**
- `public/sw.js` (push + notificationclick handlers)
- `public/sounds/notification.mp3` (replaced with louder chime)
- `src/lib/notification-alert.js` (audio unlock, repeat, stronger vibration, gated permission request)
- `src/components/notifications/NotificationBell.jsx` (enable-alerts CTA, subscribe call)

**Migration**
- create `push_subscriptions` table + RLS
- after-insert trigger on `notifications` → `send-push`

**Secrets**
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
