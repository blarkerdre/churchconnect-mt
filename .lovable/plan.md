# Why published changes aren't showing up

Your app previously shipped a full PWA/service worker, and `public/sw.js` is now a kill-switch worker that unregisters itself and clears legacy caches. That works for *most* returning browsers, but a few scenarios can still serve stale HTML/JS on the live domain:

1. **Installed PWA on a phone/desktop** — an installed app can keep running the old service worker until the OS re-launches it and the kill-switch worker activates. Until then, users see the previous build.
2. **Aggressive browser HTTP cache** — Safari (iOS) and some Android browsers hold `index.html` / JS chunks for a session even after publish.
3. **Custom domain edge cache** — `app.churchmanagementsuite.org` may be sitting behind Cloudflare or another proxy that's caching HTML.
4. **Publish scope confusion** — only **frontend** goes live when you click Publish. Edge function / DB changes deploy immediately and independently, so "not reflecting" can also mean an edge function actually did deploy but the frontend calling it wasn't republished (or vice versa).
5. **Which URL you're viewing** — `churchconnect-mt.lovable.app` vs `app.churchmanagementsuite.org` vs the preview URL all serve the same build once published, but a stale tab on one won't refresh the other.

## Diagnostic plan (no code changes yet)

Step 1 — Confirm which URL and which change
- Ask you: exact live URL you're checking, and one specific change you expect to see but don't.

Step 2 — Verify the deploy actually shipped
- Open the live URL in a **private/incognito window** with DevTools → Network → "Disable cache" ticked, hard-reload.
- If the change appears here → it's a client cache / installed-PWA issue on your normal browser.
- If it *still* doesn't appear → the publish didn't include the change (needs re-publish) or a CDN in front of the domain is caching.

Step 3 — Clear stuck service worker for affected users
- DevTools → Application → Service Workers → Unregister, then Application → Storage → Clear site data, then reload.
- On installed PWA: fully close the app (swipe away), reopen twice — the kill-switch worker activates on the second launch.
- Users can also visit `https://<site>/?sw=off` style URL — but note the current `public/sw.js` doesn't implement that flag; it just auto-unregisters on activate.

Step 4 — Check custom domain caching
- If step 2 shows the Lovable subdomain updated but the custom domain didn't, there's a proxy/CDN in front of `app.churchmanagementsuite.org` holding HTML. Purge that cache or lower TTL.

## Likely fix

Based on which step above reproduces:
- **Installed PWA stale** → add a visible "App version" string in the footer sourced from build time, so you can tell at a glance which build a device is on; document the "close app twice" recovery.
- **HTML cached at edge** → add/verify `Cache-Control: no-cache` on `index.html` (Lovable hosting already does this for `.lovable.app`, so this only applies if a custom proxy sits in front).
- **Publish wasn't clicked after latest edits** → republish.

## Next step

Please answer step 1 (URL + specific missing change) and try step 2 (incognito hard-reload). I'll then either (a) confirm it's a device cache and add a build-version badge + recovery instructions, or (b) investigate the deploy/CDN path.
