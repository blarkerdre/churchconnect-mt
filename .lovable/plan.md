
## Part 1 — Add the Android note to the Install dialog

In `src/components/pwa/InstallAppDialog.jsx`, add a small informational note that appears only for Android (non-iOS) users in the install dialog body. Wording:

> **Heads up for Android users:** After installing, Google may show a Play Protect warning that the app "is built for an older version of Android." This comes from Android itself, not from this app — your data is safe. Tap **Install anyway** to continue. Google updates this automatically over time.

Styled as a subtle muted info box (`bg-muted/50`, small text, `Info` icon from lucide-react) placed below the existing install instructions. Only rendered when `!isIOS`.

No other files change.

## Part 2 — Can this app be put on the Play Store?

Short answer: **yes, but not from Lovable directly.** Lovable builds web apps (React + Vite). The Play Store only accepts Android app packages (`.aab` / `.apk`). There are three realistic paths:

### Option A — Trusted Web Activity (TWA) via Bubblewrap *(recommended)*
Wraps the existing PWA in a thin native Android shell that opens the live site fullscreen with no browser UI. The app on Play Store *is* the deployed Lovable site.

- Requires: a published custom domain (already have `app.churchmanagementsuite.org`), a valid PWA manifest (already in place), HTTPS (already), and a Digital Asset Links file at `/.well-known/assetlinks.json` to verify domain ownership.
- Tooling: Google's [Bubblewrap CLI](https://github.com/GoogleChromeLabs/bubblewrap) generates a signed `.aab` in ~10 minutes.
- Cost: $25 one-time Google Play developer account.
- Pro: any update to the web app is instantly live in the installed Android app — no resubmission needed.
- Con: must be done outside Lovable (on your laptop or a CI runner). Solves the Play Protect warning permanently because the app is now distributed through Play.

### Option B — Capacitor / PWABuilder
Same idea as TWA but wraps the app in a WebView with optional native plugins (camera, push, etc.). Slightly heavier. Use this only if you need deeper Android-native APIs.

### Option C — Stay PWA-only
Keep the current "Add to home screen" flow. No Play Store presence, but the Play Protect warning continues to appear on install until Chrome bumps the WebAPK targetSdkVersion upstream.

### Recommendation
Go with **Option A (TWA via Bubblewrap)** once the app is feature-stable. I can prepare the `/.well-known/assetlinks.json` route and a short step-by-step Bubblewrap guide as a follow-up task — that part lives outside the Lovable codebase but I can scaffold everything Lovable needs to support it.

## Files changed in this plan
- `src/components/pwa/InstallAppDialog.jsx` — add Android Play Protect note.
