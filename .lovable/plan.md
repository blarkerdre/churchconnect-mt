## Diagnosis

I traced the hover popover path (`SermonRichEditor` → `BibleRef` mark → `BibleRefPopover` → `lookupVerses` → dynamic import of `src/assets/bible/kjv.json`). Four real problems combine to make the popover flaky in production:

1. **Duplicate `underline` extension crashes/misbehaves the editor.** The console shows:
   `[tiptap warn]: Duplicate extension names found: ['underline']`
   Current Tiptap `StarterKit` already bundles the `Underline` mark, but `SermonRichEditor.jsx` also adds `Underline` manually. Duplicate marks corrupt the schema — the `bibleRef` mark can be dropped or refuse to attach on paste/rehydrate, which is why the hover works right after typing but disappears after save/reload.

2. **The 4.36 MB KJV JSON dynamic-imports as its own chunk.** On slow mobile / flaky Wi‑Fi the chunk can fail. Every failure is currently swallowed:
   - `prewarmBible()` uses `.catch(() => {})`
   - `lookupVerses` inside the popover falls into `catch { data:null }` → the popover renders "Verse not found." with no retry, no signal, no fallback.
   This matches the "sometimes works, sometimes doesn't" symptom.

3. **The stale service worker (`public/sw.js`) can serve or invalidate old chunks mid-session.** It unregisters itself but during that transition the KJV chunk request can be intercepted / cache-missed, producing chunk-load errors that surface as "Verse not found" or a stuck "Loading verse…".

4. **Touch/mobile behaviour is racy.** Current viewport is 384px (mobile). On tap:
   - `click` opens the popover.
   - The same tap fires `mouseout` on the reference → schedules a 180 ms `hide`.
   - Result: popover flashes and disappears. The popover also never repositions on scroll of the editor's `max-h-[400px] overflow-y-auto` container, so it can end up detached from the reference.

Secondary: popover uses `position: fixed` computed once from `getBoundingClientRect()`; if the container scrolls it drifts off-screen.

## Fix plan

### 1. Remove duplicate Underline (root cause of mark instability)
- In `src/components/sermons/SermonRichEditor.jsx`:
  - Drop `import Underline from "@tiptap/extension-underline"` and remove `Underline` from the `extensions` array.
  - Keep the toolbar button — `StarterKit` already provides `toggleUnderline()` / `isActive("underline")`.
- Verify by reloading a saved sermon that contains a Bible ref — the `bibleRef` mark must survive the round-trip.

### 2. Make verse lookup resilient
In `src/lib/bible/refs.js`:
- Wrap `loadKjv()` so a failed dynamic import (chunk load error, offline) is retried once, then reported with a typed error (`"KJV_UNAVAILABLE"`) instead of silently returning `null`.
- Add a network fallback for a single verse only when the local bundle is unavailable: fetch `https://bible-api.com/{ref}?translation=kjv` (public, no key, CORS-enabled) and adapt the response to the existing shape. Cache the result in-module. This keeps the local path as primary; the API is only used when the bundle failed.
- Do not preload KJV eagerly on the whole app — only prewarm when the Sermon Notes route is mounted (already scoped via the editor mount).

In `src/components/sermons/BibleRefPopover.jsx`:
- Distinguish three render states: `loading`, `error` (with a retry link), and `found`. Today "error" collapses into "not found", which is misleading.
- Reposition on `scroll` (capture) and `resize` while open, so the card follows the reference inside the editor's scroll container.

### 3. Fix touch behaviour
In `BibleRefPopover.jsx`:
- Detect coarse pointers (`matchMedia("(hover: none)")`) and skip the `mouseout → scheduleHide` path entirely; on touch, only close via outside-tap or an explicit close affordance.
- On mobile, render the popover as a bottom sheet-style card (full-width, anchored to bottom) instead of a 320 px floater to avoid clipping at 384 px viewports.

### 4. Neutralise service-worker interference
- `public/sw.js` already self-unregisters, but users who visited earlier builds may still be mid-transition. Add a small guard in `src/main.jsx` (if not already present) that calls `navigator.serviceWorker.getRegistrations()` and unregisters any leftover registration on load. This removes any lingering interception of the KJV chunk.

### 5. Verification
- Reload an existing sermon with `John 3:16` — hover shows verse; save, reload, hover still works (validates fix 1).
- Throttle network to Slow 3G, hover a reference — popover shows a clear "Couldn't load verse — retry" state, retry succeeds via API fallback (validates fix 2).
- On mobile viewport (384 px), tap a reference — popover appears and stays until dismissed (validates fix 3).
- Check console: no more duplicate-extension warnings, no unhandled chunk-load errors.

## Files touched

- `src/components/sermons/SermonRichEditor.jsx` — remove duplicate Underline.
- `src/lib/bible/refs.js` — retry + API fallback for `lookupVerses`.
- `src/components/sermons/BibleRefPopover.jsx` — error state, scroll reposition, touch-aware behaviour, mobile layout.
- `src/main.jsx` — one-time SW cleanup guard (only if not already there).

No DB / RLS / edge-function changes. No visual redesign beyond the popover's error and mobile states.
