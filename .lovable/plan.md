

## Use Uploaded Logo on Auth and Landing Pages

Copy the uploaded logo to the project and replace the current default logo references.

### Changes

1. **Copy file**: `user-uploads://tenant-logo.png` → `public/lovable-uploads/church-connect-logo.png`

2. **`src/pages/Auth.jsx`** — Update the fallback logo path from `/lovable-uploads/40e09a54-d633-4f1c-bbfc-1ef23b34fa49.png` to `/lovable-uploads/church-connect-logo.png`

3. **`src/pages/LandingPage.jsx`** — Replace all 4 references to `/lovable-uploads/40e09a54-d633-4f1c-bbfc-1ef23b34fa49.png` with `/lovable-uploads/church-connect-logo.png` (navbar, hero icon, hero background, footer)

### Files changed
- `public/lovable-uploads/church-connect-logo.png` (new — copied from upload)
- `src/pages/Auth.jsx`
- `src/pages/LandingPage.jsx`

