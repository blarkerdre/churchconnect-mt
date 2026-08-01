## What's wrong

Two confirmed problems:

1. **The uploaded logo URL doesn't work.** The Bible School logo is uploaded to the `church-documents` storage bucket, which is **private**, but the code builds a *public* URL for it. That URL is rejected, so the image shows broken/blank in the settings preview, on the Statement of Result, and in the Course Final Report (preview, print and Word).
2. **No logo is actually stored.** Every certificate template row currently has `wofbi_logo_url`, `logo_url` and `crest_image_url` empty, so all surfaces silently fall back to the church's general logo. That is consistent with uploads appearing to fail and never being saved.

A third, smaller issue: once a Course Final Report has been saved, its cover keeps the logo it was created with, so a later logo change won't show on that saved report until it's refreshed.

## Fix

1. **Store Bible School logos in a bucket that can be served.** Move the WoFBI logo upload (and the crest/logo uploads used by certificate templates) to the existing public `tenant-branding` bucket, under a tenant-scoped path (`{tenantId}/wofbi-logo/...`), so the public URL genuinely resolves. Keep the timestamped filename so there is no browser caching of an old image.
2. **Show a working preview immediately** in Certificate Template settings after upload, and surface a clear error if the save fails.
3. **Backfill safety:** if any older logo URLs point at `church-documents`, resolve them through a signed URL instead of a public one so existing rows don't break.
4. **Keep report covers current:** on the Course Final Report, always resolve the logo live from the certificate template (falling back to the church logo) instead of using the stale value stored on a saved report, and keep the manual "Logo URL" override working if someone has typed one in.

## Technical notes

- `src/components/certificates/CertificateTemplateSettings.jsx` — change upload target bucket for `wofbi_logo_url` (and related image uploads), preview via public URL from `tenant-branding`.
- `src/components/exams/StatementOfResult.jsx` and `src/components/exams/CourseReportTab.jsx` — logo resolution order stays `wofbi_logo_url → crest_image_url → logo_url → tenant logo`, but the report export uses the live value rather than the persisted `cover.logo_url`.
- `src/lib/wofbi-report-docx.js` fetches the logo for the Word export; a public URL is required there, which the bucket change provides.
- No database migration is needed; only storage location and URL resolution change.
