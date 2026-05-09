## Collapse Favicon & Social Image into "Advanced branding"

Wrap the existing Favicon & Social Image card body in a collapsible (shadcn `Collapsible`), closed by default, with a clear header note that the tenant logo is used automatically.

### Changes
- `src/pages/Settings.jsx`: Convert the `Favicon & Social Image` card so the upload UI lives inside a `<Collapsible>` (default closed). The card header keeps the title and shows a "Customize" chevron toggle. Helper text becomes: "Your church logo is used automatically for the favicon and social/link preview image. Expand to upload custom overrides."
- No changes to logic, storage, or `TenantThemeProvider` — the auto-logo fallback is already in place.

### Out of scope
- Removing the `favicon_url` / `og_image_url` columns or storage.
- Touching the PWA icon section.