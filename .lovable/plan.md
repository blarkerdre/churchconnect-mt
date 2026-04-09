

## Rename "wofbi-register" to "bible-school-register" in URLs

### Changes

#### `src/App.jsx`
- Line 194: `/wofbi-register` → `/bible-school-register`
- Line 194: `DefaultTenantRedirect to="wofbi-register"` → `to="bible-school-register"`
- Line 205: `/t/:tenantSlug/wofbi-register` → `/t/:tenantSlug/bible-school-register`

#### `src/components/exams/WoFBIRegistrationQRCode.jsx`
- Line 30: URL path `wofbi-register` → `bible-school-register`
- Line 53: Download filename `wofbi-registration-qr` → `bible-school-registration-qr`

#### `src/pages/PublicWoFBIRegistration.jsx`
- No URL path changes needed (this file doesn't reference its own route path aside from the edge function call, which stays as `public-wofbi-register` since that's the function name)

Internal identifiers (component names, file names, edge function names, database columns like `wofbi_highest_level`) remain unchanged — only the user-facing URL slug changes.

### Files changed
- `src/App.jsx` — update 3 route paths
- `src/components/exams/WoFBIRegistrationQRCode.jsx` — update QR code URL and download filename

