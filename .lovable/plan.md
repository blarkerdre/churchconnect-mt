## Goal
Make the PWA install icon and app name automatically derive from the tenant's existing logo and name — no separate "App Icon (PWA)" upload required.

## Current behaviour
- `TenantThemeProvider` already builds the manifest with:
  - `name` / `short_name` from `currentTenant.name`
  - `icons` from `settings.pwa_icon_url` → falls back to `logo_url` → falls back to static `/icon-192.png`
- `Settings → Branding` exposes a separate **App Icon (PWA)** upload (`pwa_icon_url`), which is redundant when a tenant logo is already set.

## Changes

### 1. `src/components/tenants/TenantThemeProvider.jsx`
- Reorder fallback so the **tenant logo is the primary source**:
  `iconUrl = currentTenant?.logo_url || currentTenant?.settings?.pwa_icon_url || null`
- Keep `pwa_icon_url` as a deprecated override (in case a tenant ever uploaded one). No other manifest changes; `name`/`short_name` already use the tenant name.
- Same fallback applied to `apple-touch-icon`.

### 2. `src/pages/Settings.jsx` (Branding card)
- Remove the **App Icon (PWA)** uploader block (lines ~845–870) and its supporting state (`pwaInputRef`, `uploadingPwa`, `pwaIconUrl`, the `"pwa-icon"` branch in `handleUpload`/`handleRemove`).
- Add a small helper line under the Logo uploader: *"Your logo is also used as the install icon when members add the app to their home screen."*

### 3. No DB changes
Existing `pwa_icon_url` settings rows are left untouched (harmless, still honoured as a manual override).

## Out of scope
- Service worker / offline behaviour (none added)
- `manifest.json` static file
- Caching / re-install prompts for users who already installed the PWA (manifest fields are pinned at install time on iOS/Android)
