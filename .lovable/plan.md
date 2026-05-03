## Use Transparent Logo Across the App

### What changes
1. Add the transparent logo as a new asset: `public/lovable-uploads/church-connect-logo-transparent.png` (copied from the previously generated `/mnt/documents/logo-transparent.png`).
2. Update the two files that reference the logo to use the transparent version and render it so it fits its containers properly (no cropping, no stretching, transparent background showing through).

### Files to update

**`src/pages/LandingPage.jsx`** (3 spots)
- **Navbar**: swap to transparent logo, drop the `rounded` class (no bg to round), keep `h-8 w-8` with `object-contain`.
- **Hero badge**: the navy `bg-white/10` rounded-2xl tile currently wraps the logo. With a transparent logo we can either:
  - Keep the tile and place the logo inside at `h-12 w-12 object-contain` (recommended — looks like an app-icon badge), or
  - Remove the tile and show the logo at `h-20 w-20 object-contain` directly on the hero gradient.
  Default to option A unless you tell me otherwise.
- **Footer**: swap to transparent logo, `h-6 w-6 object-contain`, no `rounded`.

**`src/pages/Auth.jsx`**
- Swap the same logo reference to the transparent version with `object-contain` sizing (will inspect exact spot during implementation).

### Notes
- Keep the original `church-connect-logo.png` in place (still referenced by manifest/PWA flows that expect a solid background). Only swap in-app UI usages to the transparent variant.
- No favicon/PWA icon changes — those still need a solid background.