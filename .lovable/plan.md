## Fix: Croydon PWA showing "WCI Cardiff" name

### Root cause recap

Three places hardcode `Winners Chapel Cardiff` / `WCI Cardiff` and run **before** the per-tenant `TenantThemeProvider` resolves the active tenant. Whichever one the browser sees first is what gets installed onto the home screen — and on install, the OS freezes that name.

1. `public/manifest.json` — static, served at `/manifest.json`, referenced from `index.html` line 12.
2. `index.html` line 10 — `<title>Church Connect - MT</title>` (not Cardiff but also not neutral; harmless but tightening for consistency).
3. `src/components/tenants/TenantThemeProvider.jsx` line ~152 — `const tenantName = currentTenant?.name || "Winners Chapel Cardiff";` falls back to Cardiff when tenant context is still loading.

The dynamic per-tenant manifest blob still works correctly **after** the tenant resolves, but installs and cold-tab titles fired during that ~200–800ms window get the Cardiff fallback.

A separate, deeper limitation: all tenants share `app.churchmanagementsuite.org`, so the OS treats them as one PWA per device. That's not fixed here — see "Out of scope" below.

### Changes

#### 1. `public/manifest.json` — neutralise

Replace Cardiff-specific name, short_name, description, and icons with generic Church Management Suite branding. Use the existing generic `/icon-192.png` and `/icon-512.png` placeholders (these are already neutral PNGs in `public/`).

```json
{
  "name": "Church Management Suite",
  "short_name": "Church MS",
  "description": "Multi-tenant Church Management Suite",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1e3a5f",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

This is the static fallback. The dynamic per-tenant manifest in `TenantThemeProvider` continues to overwrite this once the tenant resolves.

#### 2. `index.html` — neutralise hardcoded title and confirm icon

- `<title>Church Connect - MT</title>` → `<title>Church Management Suite</title>` (already neutral wording, but removing "MT" project codename leak).
- `<link rel="apple-touch-icon" href="/icon-192.png" />` is already neutral — leave as-is. `TenantThemeProvider` already overwrites it dynamically per tenant.

#### 3. `src/components/tenants/TenantThemeProvider.jsx` — remove Cardiff fallback

In the dynamic-manifest `useEffect` (~line 152):

```jsx
// Before:
const tenantName = currentTenant?.name || "Winners Chapel Cardiff";

// After:
const tenantName = currentTenant?.name || "Church Management Suite";
```

Same effect: if the tenant hasn't resolved yet, the manifest blob and PWA name show neutral branding instead of Cardiff. Once the tenant resolves, the correct tenant name (Croydon, Cardiff, etc.) replaces it.

### Verification

After deploy:

1. **Cold visit to `/t/croydon`** in an incognito window → tap "Add to Home Screen" → shortcut should read "Croydon" (the tenant's `name` field) — never "WCI Cardiff".
2. **Cold visit to `/`** (no tenant context) → shortcut reads "Church Management Suite", not "WCI Cardiff".
3. **In-browser tab title** during initial load shows "Church Management Suite", then updates to the tenant name once resolved.
4. **Cardiff users**: still see "Winners Chapel Cardiff" because that's their tenant's `tenants.name` field — unchanged behaviour.

### Migration notes for already-installed Croydon users

PWAs freeze the manifest at install time. **Existing Croydon users who installed when the manifest still said "WCI Cardiff" must uninstall and reinstall** to pick up the new name. There's no programmatic way to update an installed PWA's home-screen label — this is an OS limitation, not a code issue. We should mention this to Croydon admins.

### Out of scope (intentionally)

- **Per-tenant subdomains** (e.g. `croydon.churchmanagementsuite.org`). This would give each tenant a fully distinct PWA identity (different installed app per tenant on the same device). It's the only way to truly isolate PWA installs across tenants on iOS/Android. Requires DNS, a separate Lovable project per the `mem://architecture/domain-mapping` rule (one custom domain per project), and significantly more setup. Park for later if the shared-origin install-collision becomes a real complaint.
- **`public/sw.js`**: confirmed it's a push-only SW with no caching, so it's not contributing to the bug. No change needed.

### Files touched

- `public/manifest.json` — replace contents.
- `index.html` — change `<title>`.
- `src/components/tenants/TenantThemeProvider.jsx` — change Cardiff string fallback.

No DB, RLS, or edge function changes.