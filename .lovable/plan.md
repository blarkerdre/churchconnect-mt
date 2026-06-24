## What I found

- The code is healthy. The dev server returns 200, the published site (`churchconnect-mt.lovable.app/index`) renders the landing page correctly, and a headless browser hitting `localhost:8080/index` renders fine with no runtime errors.
- `src/main.jsx` already rewrites `/index` → `/` before React mounts, so the URL itself isn't the problem.
- No `serviceWorker.register('/sw.js')` call exists in app startup, so a stale SW from a *previous* build is the most likely culprit when only the iframe is blank while the published site works.
- You confirmed: blank only in the Lovable preview iframe, with **no console errors** — that pattern matches a stale cached asset / service-worker registration in the iframe origin, not a code regression.

## Proposed fix (one-shot)

Add a tiny same-path kill-switch to `public/sw.js` so any previously registered service worker on the preview origin unregisters itself and clears its own caches on next load. This is the standard Lovable PWA cleanup pattern and is safe for the published app (no SW is registered at startup anyway).

### Steps

1. Replace `public/sw.js` with the kill-switch worker from the PWA skill: on `activate`, delete only its own Workbox-style caches, claim clients, navigate them to refresh, then `registration.unregister()` in `finally`.
2. Leave the rest of the codebase alone — no route changes, no main.jsx changes, no new SW registration.
3. After deploy / preview refresh, ask you to hard-refresh the iframe once (Cmd/Ctrl+Shift+R) so the replacement worker activates.

### What this does NOT change

- Push-notification flow (`usePushSubscription.js`, `notification-alert.js`) — those rely on `navigator.serviceWorker.ready` and will be unaffected because nothing in the app currently registers `/sw.js` at boot.
- Routing, auth, tenant logic, UI.

### If the kill-switch doesn't resolve it

Likely a transient sandbox/iframe issue rather than code. Next step would be to click "Restart preview" in Lovable, or open the preview in a new tab via the URL chip to confirm.

Approve and I'll apply the kill-switch worker.
