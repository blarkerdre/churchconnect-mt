## Goal
Help users with already-installed PWAs see the latest tenant name and icon. iOS/Android pin manifest fields (name, icons, start_url) at install time, so the only reliable refresh is reinstalling. We can't push silent updates — but we can detect staleness and prompt the user.

## Approach
Add a lightweight "PWA out of date" detector + reinstall banner that appears only inside an installed PWA when the tenant's current branding (name or logo URL) doesn't match what the manifest was when the app was installed.

## Changes

### 1. Track install-time branding fingerprint
In `TenantThemeProvider.jsx`, when generating the dynamic manifest, also write a fingerprint to `localStorage`:
- `pwa:installed:tenantSlug` → tenant slug at first standalone launch
- `pwa:installed:name` → tenant name
- `pwa:installed:logoUrl` → tenant logo url
- `pwa:installed:at` → timestamp

Only set these once (on first standalone launch where they're missing). This becomes the snapshot of what the OS likely cached.

### 2. New component `PWAUpdateBanner.jsx`
- Detects standalone mode: `window.matchMedia('(display-mode: standalone)').matches` or `navigator.standalone` (iOS).
- Compares stored fingerprint against current `currentTenant.name` and `currentTenant.logo_url`.
- If they differ, shows a dismissible banner: "Your installed app shows outdated branding. Reinstall to update the icon and name." with platform-specific instructions:
  - iOS: "Long-press the home-screen icon → Remove App → reopen in Safari → Share → Add to Home Screen"
  - Android: "Long-press the icon → App info → Uninstall → reopen in Chrome → Install app"
- Includes a "Got it" button that updates the stored fingerprint to current values (so banner doesn't reappear unless branding changes again).
- Only shown to signed-in users (skip on auth/public pages to avoid noise).

### 3. Mount the banner
Render `<PWAUpdateBanner />` once inside `AppLayout.jsx` near the top (above page content, below header).

### 4. Bonus: keep theme_color/background fresh for new installs
Update the dynamic manifest in `TenantThemeProvider.jsx` to use the tenant's `primary_color` for `theme_color` (and a near-white for `background_color`). New installs will then pick up tenant-tinted splash screens.

## Out of scope
- No DB / RLS / edge-function changes.
- No service worker changes (project intentionally has minimal SW).
- No forced uninstall — OS doesn't allow that.

## Files touched
- `src/components/tenants/TenantThemeProvider.jsx` (fingerprint + theme_color)
- `src/components/PWAUpdateBanner.jsx` (new)
- `src/components/AppLayout.jsx` (mount banner)
