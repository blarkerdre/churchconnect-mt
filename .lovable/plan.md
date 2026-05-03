# Replace Global Default App Icons

Swap the project-wide default favicon and PWA app icons with the uploaded gold-cross-on-navy logo. These defaults are shown only when a tenant has not configured its own `favicon_url`, `pwa_icon_url`, or `logo_url`.

## Files to replace in `public/`

Generate from the uploaded image (`user-uploads://tenant-logo-2.png`) using ImageMagick, padding to a square canvas with the navy background so the circular logo isn't cropped:

- `public/favicon.jpg` — 256×256 (default favicon referenced by `TenantThemeProvider`)
- `public/favicon.ico` — 64×64 (browser fallback for `/favicon.ico`)
- `public/icon-192.png` — 192×192 (PWA + apple-touch-icon)
- `public/icon-512.png` — 512×512 (PWA install icon)

No code changes needed — `index.html`, `public/manifest.json`, and `TenantThemeProvider.jsx` already reference these exact paths.

## QA

After generation, view each output file to confirm the logo is centred, uncropped, and the navy background is preserved. Re-run if any look wrong.

## Out of scope

- Tenant-specific branding overrides (unchanged)
- `manifest.json` `theme_color` / `background_color` (already navy `#1e3a5f` / white — leave as-is unless you want them changed)
