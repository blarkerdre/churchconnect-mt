## Use tenant logo for Favicon and Social/OG image (auto-fit)

### Approach
Make the tenant logo the default source for favicon and OG image, so admins don't have to upload three separate images. Generate properly-sized variants on the client using a canvas, mirroring how PWA already does it.

### Behavior
- **Favicon**: When `currentTenant.settings.favicon_url` is set, use it (current behavior). Otherwise, if `currentTenant.logo_url` exists, render it onto a 64×64 square canvas (white background, contained, centered) and set the favicon to the canvas data URL. Falls back to `/favicon.jpg` only if neither exists.
- **OG image**: Same priority — explicit `og_image_url` wins; otherwise build a 1200×630 canvas (brand-colored background using the tenant's `primary_color`, logo centered + church name underneath in white), and use it for `og:image` and `twitter:image`. Falls back to current default URL only if no logo either.
- **PWA icon**: already uses logo. Keep as-is, but render to 512×512 square on a white background so non-square logos look right.

Canvas generation runs in `TenantThemeProvider` `useEffect`s, generating data URLs (or blob URLs that get revoked on cleanup). Pure client-side — no edge functions, no storage upload.

### Settings UI
In `src/pages/Settings.jsx`'s favicon/OG card, add a small note: "Defaults to your church logo if no custom image is uploaded." No layout changes; the upload buttons remain for users who want a custom image.

### Files
- Edited: `src/components/tenants/TenantThemeProvider.jsx` — add `renderSquareIcon()` and `renderOgCard()` helpers, fall back to logo-derived data URLs.
- Edited: `src/pages/Settings.jsx` — add helper text under the favicon/OG section.

### Out of scope
- Server-side image processing / Sharp.
- Persisting the generated images to storage (kept ephemeral; regenerated on each load).
- Changing the existing `pwa_icon_url` field semantics.