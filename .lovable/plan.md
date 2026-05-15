## Goal

Resolve the security finding by making `church-documents` private again, while keeping the dashboard slideshow (the original reason it was made public) working.

## Approach

Move public-facing dashboard banner images to a dedicated public bucket, and keep all other content (certificates, report attachments, member-uploaded docs) in a private `church-documents` bucket served via signed URLs.

## Changes

### 1. Storage migration

- Create new public bucket `dashboard-banners` with RLS:
  - Public `SELECT` (anyone can read)
  - `INSERT/UPDATE/DELETE` restricted to admins / unit leaders of the tenant whose `tenantId` matches the first path segment
- Set `church-documents` back to `public = false`

### 2. Banner code

- `src/components/settings/DashboardBannerSettings.jsx`: upload to `dashboard-banners` instead of `church-documents`; keep using `getPublicUrl`
- Existing banner URLs already saved in `app_settings.dashboard_banners` will continue to resolve because the bucket they point to (`church-documents`) will still serve via signed URL only — so we also add a one-time migration step: copy existing banner files from `church-documents/<tenant>/banners/*` to `dashboard-banners/<tenant>/banners/*` and rewrite the stored URLs in `app_settings`. (Or, simpler: ask admins to re-upload — see Decision below.)

### 3. No code changes needed for these (already use signed URLs):

- `MyCertificates.jsx` — `createSignedUrl` ✓
- `CertificateTemplateSettings.jsx` — `createSignedUrl` ✓
- `ReportAttachments.jsx` — `createSignedUrl` ✓
- `issue-certificate` edge function — server-side, unaffected
- `purge-all-data` edge function — server-side, unaffected

## Decision needed

For existing banners already uploaded while the bucket was public, choose one:

**A. Auto-migrate (recommended)** — migration script copies existing `church-documents/<tenant>/banners/*` objects into `dashboard-banners/` and updates `app_settings.dashboard_banners` URLs. Zero admin action.

**B. Re-upload** — leave existing banners broken; admins re-upload through the new bucket. Simpler migration, slight UX cost.

I'll go with **A** unless you say otherwise.

## Result

- `church-documents` becomes private — finding resolved
- Certificates, reports, member docs continue to work via signed URLs
- Dashboard slideshow keeps using fast public URLs from a properly scoped public bucket
