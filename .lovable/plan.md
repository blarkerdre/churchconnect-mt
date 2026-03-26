

## Plan: Per-Tenant Favicon and Public Image (OG Image)

### What We're Building

Each tenant will be able to upload and configure:
1. **Custom favicon** -- displayed in the browser tab when users are in that tenant's context
2. **Public/social image (OG image)** -- used for link previews when the tenant's URL is shared on social media or messaging apps

### How It Works

**Storage**: Both images are stored in the existing `profile-photos` bucket under `{tenantId}/tenant-favicon` and `{tenantId}/tenant-og-image` paths (same pattern as tenant logos).

**Database**: The URLs are saved in `tenants.settings` JSON alongside existing fields like `primary_color`, `email_sender_name`, etc. New keys: `favicon_url` and `og_image_url`.

**Dynamic favicon**: The `TenantThemeProvider` component (already watches tenant changes) will be extended to dynamically update the `<link rel="icon">` element in the document head when the tenant context changes.

**Dynamic OG meta tags**: A similar effect in `TenantThemeProvider` will update `<meta property="og:image">` and `<meta name="twitter:image">` tags dynamically based on the tenant's configured OG image. For the Auth page (pre-login), the tenant branding query already fetches tenant data -- we'll include the settings to set OG tags there too.

### Changes

**1. Settings page -- new "Branding" fields** (`src/pages/Settings.jsx`)
- Add favicon upload and OG image upload fields in the existing Branding tab
- Upload to `profile-photos` bucket with tenant-prefixed paths
- Save URLs to `tenants.settings.favicon_url` and `tenants.settings.og_image_url`
- Show preview of current favicon and OG image with remove option

**2. TenantThemeProvider** (`src/components/tenants/TenantThemeProvider.jsx`)
- Read `favicon_url` and `og_image_url` from `currentTenant.settings`
- Dynamically set/restore `<link rel="icon">` in document head
- Dynamically set/restore OG meta tags
- On cleanup/tenant switch, restore defaults from `index.html`

**3. Auth page** (`src/pages/Auth.jsx`)
- The tenant branding query already fetches tenant data including settings
- Use `tenant.settings.favicon_url` to set favicon on the login page before auth
- Use `tenant.settings.og_image_url` for OG meta tags on tenant login pages

**4. PWA manifest** (`public/manifest.json`)
- Keep the default manifest as-is (PWA icons are app-level, not tenant-level)
- Tenant favicons apply to browser tabs only

### No database migration needed
The `tenants.settings` JSONB column already exists and is flexible enough to store these new keys.

### Technical Details
- Favicon is swapped by finding/creating `link[rel="icon"]` in `document.head` and updating its `href`
- OG tags are swapped similarly via `document.querySelector('meta[property="og:image"]')`
- Default favicon (`/favicon.jpg`) is restored when no tenant favicon is set
- Image uploads reuse the existing tenant logo upload pattern from Settings

