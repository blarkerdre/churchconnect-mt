## Root cause

The `church-documents` storage policies require the first folder of every object path to be a `tenant_id` UUID (this is how tenant isolation is enforced). Two paths violate that contract:

1. **Background upload** — `certificate-backgrounds/${timestamp}.${ext}` → Postgres tries to cast `"certificate-backgrounds"` to UUID → insert fails with the error you pasted.
2. **Issued certificates** — `certificates/${member_id}/${cert_no}.svg` → same problem; signed-URL creation is rejected, so Download throws an "Error downloading certificate" toast.

A secondary issue: even when the SVG download works, browsers open SVGs inline rather than saving them, and SVG isn't shareable on WhatsApp/social. You asked for PNG.

## Plan

### 1. Tenant-scope every storage path

- **`CertificateTemplateSettings.jsx`** `handleUpload`: upload to `${tenantId}/certificate-backgrounds/${Date.now()}.${ext}`. Guard against missing `tenantId`.
- **`issue-certificate` edge function**: write the certificate to `${tenant_id}/certificates/${member_id}/${certificateNumber}.png` (see step 2 for PNG). Store this same path in `training_completions.certificate_url`.
- **Backwards compatibility for old rows**: in `MyCertificates.handleDownload` and the issue function's email step, if `createSignedUrl(path)` fails AND the path does not start with `${tenantId}/`, retry with `${tenantId}/${path}` before showing an error. This rescues already-issued certificates without a data migration.

### 2. Generate PNG output instead of SVG

The edge function currently emits SVG. Convert to PNG inside the function:

- Use `npm:@resvg/resvg-js@2` (pure-WASM, runs in Deno Edge runtime, no system fonts needed) to rasterise the existing SVG at 2× (1684×1190) for crisp print quality.
- Embed Playfair Display + Inter as base64 woff2 in the SVG `<defs><style>@font-face>...` so text renders identically on the server (the current `@import` from Google Fonts is ignored by resvg). Bundle the two woff2 files under `supabase/functions/_shared/fonts/` and read them at cold start.
- Upload as `image/png`, `contentType: "image/png"`, filename `${certificateNumber}.png`. Update `training_completions.certificate_url` and the email link accordingly.

### 3. Force download (not inline) in the browser

- Generate signed URLs with `download: \`${certificateNumber}.png\`` — Supabase storage adds `response-content-disposition=attachment; filename=...` so the browser saves the file instead of opening it.
- Apply this in `MyCertificates.handleDownload`, the admin certificate list, and the email "Download Certificate" button.

### 4. Provide a sample background

Add a built-in sample (no upload needed):

- Generate one elegant navy/gold sample PNG (`src/assets/certificate-sample-bg.png`, 1684×1190) via the image generator.
- Add an "Use sample background" button in the Certificate Template dialog that copies that asset into the tenant's `${tenantId}/certificate-backgrounds/sample.png` (one-time, idempotent) and sets `background_image_url` to that path.
- Keep the existing user upload flow intact; the sample is just a shortcut.

### 5. Verification

- Upload a new background → confirm it lands in `${tenantId}/certificate-backgrounds/...` and the preview shows it.
- Issue a fresh certificate → confirm PNG file appears in storage under `${tenant_id}/certificates/...`, Download saves the file, email contains a working signed link.
- Open My Certificates with an existing old SVG row → fallback path-prefix retry works and the file downloads (or shows a clear "regenerate" CTA if the underlying file is gone).

### Out of scope

- Backfilling/regenerating already-issued SVG certificates as PNGs (we keep them downloadable via fallback; we can do a one-off regeneration later if you want).
- Changing the certificate visual design beyond switching SVG → PNG raster.
- Editing the storage RLS policies — the tenant-prefix contract is correct and shared with documents/branding.

### Technical notes

- resvg-js cold-start cost is ~50–150ms; acceptable for an admin action.
- We must `escapeXml` the dynamic strings before rasterisation (already done in current code).
- PNG file size at 2× ~150–300 KB; well within member storage quota.
