## Goal
Make installed PWAs use the tenant logo as the app icon and the tenant name as the app name, on iOS and Android.

## Root cause recap
The current dynamic manifest is a `blob:` URL with `data:` icons embedded. iOS/Android install pipelines can't fetch blob URLs and reject inline data icons, so they fall back to `/manifest.json` (default icon + generic name).

## Approach
Serve a real, fetchable manifest from a Supabase Edge Function, with real PNG icons stored in a public bucket. Name the manifest after the tenant.

## Steps

### 1. Storage bucket for tenant PWA icons
- Create public bucket `tenant-pwa-icons` (migration).
- Public read; writes restricted to tenant admins/owners via RLS using `user_has_tenant_access`.
- Path convention: `{tenant_id}/icon-192.png`, `{tenant_id}/icon-512.png`, `{tenant_id}/apple-touch-icon.png`.

### 2. Icon generation (client-side, on tenant load)
- In `TenantThemeProvider`, when a tenant has a `logo_url` but no cached PWA icons:
  - Render 192/512/180 PNGs on canvas (white bg, padded, centered) — reuse existing `renderSquareIcon`.
  - Upload them to `tenant-pwa-icons/{tenant_id}/...` (overwrite).
  - Store a hash/version of the source logo in `tenants.settings.pwa_icons_version` so we only re-render when the logo changes.
- Skip if `settings.pwa_icon_url` is already set explicitly (admin override).

### 3. Edge function `get-manifest`
- New function `supabase/functions/get-manifest/index.ts`, `verify_jwt = false`.
- Query: `?tenant={slug}` (or `?tenantId=`).
- Looks up tenant → returns JSON with:
  - `name`: tenant name (full)
  - `short_name`: tenant name truncated to 12 chars
  - `id` / `start_url` / `scope`: `/t/{slug}`
  - `display: "standalone"`, `theme_color`: tenant primary color, `background_color: "#ffffff"`
  - `icons`: public URLs from `tenant-pwa-icons` bucket (192, 512, with `purpose: "any maskable"`), correct MIME from extension; falls back to `/icon-192.png`, `/icon-512.png` when no tenant icons exist.
- Response headers: `Content-Type: application/manifest+json`, `Access-Control-Allow-Origin: *`, short `Cache-Control`.

### 4. Wire manifest link
- In `TenantThemeProvider`, replace the blob-manifest logic:
  - Set `<link rel="manifest" href="https://{project}.functions.supabase.co/get-manifest?tenant={slug}">` (use `import.meta.env.VITE_SUPABASE_URL`).
  - Set `<link rel="apple-touch-icon" href="{public 180px URL}">` (real URL, not data:).
  - Set `<meta name="apple-mobile-web-app-title" content="{tenant name}">` so iOS home-screen label matches the tenant.
- Remove the old blob URL + cleanup race; keep favicon logic untouched.

### 5. CORS on storage
- Bucket already public — Supabase serves `Access-Control-Allow-Origin: *` for public objects, so no extra config needed.

## Notes
- Users must remove + re-add the home-screen icon to see the new name/icon (iOS/Android cache install-time manifest fields — documented behavior, not a bug).
- Admin-uploaded `pwa_icon_url` / `og_image_url` overrides remain respected.
- No changes to `public/manifest.json` (used as the no-tenant fallback).
