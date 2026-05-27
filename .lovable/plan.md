
## Goal
Prepare everything Lovable needs to support a Google Play Store release via a Trusted Web Activity (TWA), without touching app behavior. The actual `.aab` build still happens outside Lovable in Bubblewrap, but after this plan, the domain will be ready to verify ownership and you'll have a clear checklist of assets to gather.

## Part 1 — Serve `/.well-known/assetlinks.json`

Google requires a Digital Asset Links file at `https://app.churchmanagementsuite.org/.well-known/assetlinks.json` so the TWA can prove it owns the domain (this is what removes the browser URL bar inside the installed Android app).

Approach: add a **static file** at `public/.well-known/assetlinks.json`. Vite serves everything under `public/` at the site root, so the file becomes available at the correct URL with no routing or edge function needed.

Initial contents will be a placeholder array with one entry and a `TODO_SHA256_FINGERPRINT` marker. Once you generate the signing key with Bubblewrap, you'll paste the real SHA-256 fingerprint into that one spot.

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "org.churchmanagementsuite.app",
      "sha256_cert_fingerprints": [
        "TODO_REPLACE_WITH_BUBBLEWRAP_SHA256_FINGERPRINT"
      ]
    }
  }
]
```

Package name `org.churchmanagementsuite.app` is a sensible default derived from your domain. You can change it before generating the keystore — once chosen, it's permanent for that Play Store listing.

## Part 2 — Bubblewrap checklist (outside Lovable)

After this plan ships and you've published the latest version of the app, the steps on your laptop are:

1. Install Bubblewrap: `npm i -g @bubblewrap/cli`
2. `bubblewrap init --manifest=https://app.churchmanagementsuite.org/manifest.json`
3. Confirm package name `org.churchmanagementsuite.app` (or change it).
4. Bubblewrap generates a signing keystore — **back it up**, losing it means you can never update the app.
5. Run `bubblewrap fingerprint` → copy the SHA-256.
6. Paste the SHA-256 into `public/.well-known/assetlinks.json` in Lovable, publish, verify the URL responds.
7. `bubblewrap build` → produces `app-release-bundle.aab`.
8. Upload `.aab` to Play Console, fill listing, submit for review (~1–3 days first time).

## Part 3 — Play Store listing assets you'll need to gather

Not built in this plan — just a heads-up so you can start collecting:

- **App icon**: 512×512 PNG (can reuse your existing PWA icon).
- **Feature graphic**: 1024×500 PNG/JPG (banner shown at top of store listing).
- **Phone screenshots**: at least 2, ideally 4–8, 1080×1920 (portrait).
- **Short description**: max 80 characters.
- **Full description**: max 4000 characters.
- **Privacy policy URL**: required, must be publicly accessible.
- **Content rating questionnaire**: filled in Play Console.

## Files changed
- `public/.well-known/assetlinks.json` — new placeholder file with TODO fingerprint.

## What does NOT change
- No code, no edge functions, no manifest, no PWA behavior. iOS, multi-tenancy, and per-tenant PWA logos all continue to work exactly as today.
