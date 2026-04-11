

## Fix: Demo Church PWA Icon Showing WCI Icon

### Problem
When a tenant hasn't uploaded a dedicated PWA icon (`pwa_icon_url`), the manifest falls back to hardcoded `/icon-192.png` and `/icon-512.png` files — which are Winners Chapel International icons. Other tenants (demo churches) then get WCI branding when members install the app.

### Solution
Update the fallback chain in `TenantThemeProvider.jsx` so that when `pwa_icon_url` is not set, it tries the tenant's `logo_url` before falling back to the generic static icons. This way each church's own logo is used for the PWA install icon automatically.

### Implementation

**Edit `src/components/tenants/TenantThemeProvider.jsx`** — in the PWA manifest `useEffect`:

- Change the icon source resolution to: `pwa_icon_url` → `logo_url` → static defaults
- Apply the same fallback for the apple-touch-icon link

```javascript
const iconUrl = pwaIconUrl || currentTenant?.logo_url || null;

icons: iconUrl
  ? [
      { src: iconUrl, sizes: "192x192", type: "image/png" },
      { src: iconUrl, sizes: "512x512", type: "image/png" },
    ]
  : [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
```

Also update the apple-touch-icon line:
```javascript
appleIcon.href = iconUrl || "/icon-192.png";
```

And add `currentTenant?.logo_url` to the `useEffect` dependency array.

### Files changed
- **Edit**: `src/components/tenants/TenantThemeProvider.jsx`

