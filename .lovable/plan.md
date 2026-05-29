# Fix notification alert sound

## Likely causes (from reading `src/lib/notification-alert.js` and `NotificationBell.jsx`)

1. **Audio is never unlocked in practice.** `setupAudioUnlock()` calls `audio.play()` with `muted = true` on the first `click/touchstart/keydown`. Several mobile browsers (iOS Safari, some Android WebViews) do **not** count a muted play as a valid unlock — subsequent unmuted `.play()` calls from a realtime callback are still blocked. Result: silence, no error visible to the user (all `.catch(() => {})`).
2. **Errors are completely swallowed.** Every `play()` failure is `.catch(() => {})`, so when autoplay is blocked or the file 404s, the user just hears nothing.
3. **No user-visible test.** The "Enable" button only requests `Notification` permission. The user has no way to confirm the sound is actually unlocked / audible / not muted at the OS level. We're guessing instead of letting the user verify.
4. **Preview iframe context.** In the Lovable preview, the app runs in a cross-origin iframe. Even after unlock, programmatic `.play()` from a realtime payload can be blocked unless the user has clicked **inside** the iframe first. Worth documenting in the UI copy.
5. The `triggerNotificationAlert` only fires from the `postgres_changes` INSERT subscription. If the realtime channel isn't subscribed (RLS, tenant filter, network), no sound fires at all. Worth a quick log to confirm.

## Changes

### `src/lib/notification-alert.js`
- Replace the muted-play unlock with a **real unmuted play at near-zero volume** triggered inside the gesture. This reliably unlocks on iOS/Android.
- Add a `testNotificationSound()` export that plays the full sound at normal volume — for the new Test button.
- Log (via `console.warn`) when `audio.play()` rejects, so the user/devtools can see *why* (NotAllowedError, NotSupportedError, network). Keep the `.catch` so it doesn't throw.
- Add a tiny `console.info` in `triggerNotificationAlert` so we can confirm in console whether the realtime event is reaching the client.

### `src/components/notifications/NotificationBell.jsx`
- In `handleEnableAlerts` (already a real user gesture), additionally call `testNotificationSound()` so the user **hears** the sound immediately and audio is unlocked in the same gesture.
- Add a small "Test sound" button in the popover header (next to "Mark all read"), visible once permission is granted. Calls `testNotificationSound()` from a click gesture.
- Tighten the copy of the "Enable" banner to mention: *"Tap Enable and you should hear a chime. If you don't, check your device isn't on silent."*

### Out of scope
- Service-worker push playback (already handled separately in `usePushSubscription`).
- iOS PWA limitations when the tab is fully backgrounded — that requires Web Push, not in-page audio.

## How we'll verify
After the changes, open the bell in the preview, click **Enable**, and the chime should play. Then click **Test sound** — same result. In the published app on mobile, the chime should then play when a new notification INSERT arrives in realtime.
