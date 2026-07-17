## What you're seeing

After a refresh (or the "Refresh" button in the sidebar), your phone's volume rocker suddenly controls **media volume** instead of ringer volume, and the on-screen volume slider can jump to whatever the media stream was last set to. It feels like "refresh changed my volume."

## Why it happens

The notification chime code in `src/lib/notification-alert.js` sets up an **audio unlock** that runs on the very first tap/click/keydown after the page loads:

- It creates an `<audio>` element pointing at `/sounds/notification.mp3`.
- On your first interaction it calls `audio.play()` (unmuted, at volume `0.01`) to satisfy mobile autoplay rules, then pauses it.
- Because a real media element starts playing, Android/iOS switch the volume rocker from **Ring** to **Media**, and the OS shows the media volume HUD at whatever level media is set to. On some phones that also briefly ducks other audio (Spotify/YouTube in the background).

Every refresh re-arms this unlock, so every refresh causes the same "volume changed" sensation — it's not the refresh itself, it's the silent priming play() that runs on your next tap.

There is a second, smaller contributor: on the notifications popover, `testNotificationSound()` fires at full volume from the "Enable" button, which is expected but reinforces the effect.

## Diagnosis status

Unconfirmed on your specific device — I have not reproduced it on your phone. Before changing behaviour I want to verify by:

1. Loading the app on a phone, tapping once, and watching whether the volume HUD flips from Ring to Media with no notification present.
2. Checking whether the effect goes away if the audio-unlock priming play is removed.

## Proposed fix (once confirmed)

Change the audio unlock so it does not touch the media stream unless the user actually needs the chime:

1. **Don't auto-prime on every page load.** Only unlock audio when:
   - `Notification.permission === "granted"`, AND
   - the user has opened the notification bell at least once (or clicks Enable / Test sound).
   Users who never enable notifications will never trigger a media-stream play, so refresh won't affect their volume rocker.
2. **Use a silent WebAudio ping instead of `<audio>.play()` for the unlock.** A zero-gain `AudioContext` oscillator satisfies the autoplay gesture requirement without registering as media playback, so Android/iOS don't switch the volume rocker to Media. The real chime still uses `<audio>` when a notification actually arrives.
3. **Keep the explicit "Test sound" / "Enable" buttons** playing the real chime — that's user-initiated and expected.

### Technical section

Files touched:

- `src/lib/notification-alert.js`
  - Remove the unconditional `setupAudioUnlock()` call at module load.
  - Replace `unlockAudio()`'s priming `audio.play()` with a WebAudio silent ping (`AudioContext` → `GainNode(gain=0)` → `OscillatorNode`, start+stop in the same tick).
  - Expose `unlockAudio()` and call it only from: `requestNotificationPermission()` success path, `testNotificationSound()`, and the first real `triggerNotificationAlert()` (as a fallback, still gated on permission).
- `src/components/notifications/NotificationBell.jsx`
  - No behaviour change needed; the existing `handleEnableAlerts` already gates on permission and will call the new unlock.

No changes to `forceRefresh`, the service worker, or the build-info banner — the refresh itself is not the cause.

### Out of scope

- Changing how the chime sounds or how loud it is.
- Any change to push notifications, SW registration, or the build-refresh flow.

Want me to verify on a phone first, or go straight to the fix?