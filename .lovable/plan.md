

## Add PWA Icon Management to Branding Settings

### What changes

Add a **PWA App Icon** upload/remove section to the existing `FaviconOgImageSection` in Settings → Branding. This lets tenant admins upload a custom icon that will be used when members install the app to their home screen.

### How it works

1. **Settings UI (`src/pages/Settings.jsx`)** — Add a third upload slot in `FaviconOgImageSection` for "App Icon (PWA)":
   - Upload stores image to `profile-photos` bucket as `{tenantId}/tenant-pwa-icon.png`
   - Saves the public URL to `tenants.settings.pwa_icon_url`
   - Shows preview, upload, and remove buttons (same pattern as favicon/OG image)
   - Helper text: "Icon shown when members install the app to their home screen (recommended: 512×512 PNG)"

2. **Dynamic manifest (`TenantThemeProvider.jsx`)** — Add a `useEffect` that updates the PWA manifest dynamically:
   - Create a blob-based `manifest.json` with the tenant's `pwa_icon_url` (or defaults) and `name` set to the tenant name
   - Update `<link rel="manifest">` href to point to the blob URL
   - Also update `<link rel="apple-touch-icon">` to use the custom icon
   - Clean up blob URL on unmount

3. **No database migration needed** — `pwa_icon_url` is stored in the existing JSON `settings` column on `tenants`.

### Files changed

- **`src/pages/Settings.jsx`** — add PWA icon upload/remove in `FaviconOgImageSection`
- **`src/components/tenants/TenantThemeProvider.jsx`** — dynamically update manifest and apple-touch-icon

