## Goal

Make the Bible School (WOFBI) logo appear reliably — and undistorted — in the Statement of Result print/PDF and the Course Final Report print/Word download.

## What I confirmed in the code

- `src/components/exams/StatementOfResult.jsx` builds print HTML with a raw remote `<img src>` and calls `win.print()` after a fixed 300 ms timer — the image usually has not loaded yet, so the logo prints blank. It also uses the raw `wofbi_logo_url` without `resolveBrandingUrl`, so legacy `church-documents` (private bucket) URLs never resolve.
- `src/lib/wofbi-report-docx.js` `fetchLogo()` silently returns `null` on any CORS/404 failure, so the Word file ships with no logo and no warning.
- `src/lib/wofbi-report-export.js` already waits for images before printing (good), but it prints whatever URL is stored, including expired signed URLs saved into `report.cover.logo_url`.
- `supabase/functions/_shared/generate-statement.ts` looks up `certificate_templates` with an exact `training_type = course.name` match only (the client uses the tolerant `fetchCourseTemplate` matcher), so the server PDF frequently finds no template and no Bible School logo. `statement-pdf.ts` also draws the logo into a fixed 28×28 mm square, distorting non-square logos.

## Changes

### 1. Shared logo-to-data-URL helper (frontend)
Add a small helper (e.g. `src/lib/logo-data-url.js`) that: resolves legacy private URLs via `resolveBrandingUrl`, fetches the image, and returns a base64 data URL plus its natural width/height. Data URLs remove all load-timing, CORS and expiry problems in printed documents.

### 2. Statement of Result print
- Resolve the logo through the new helper before opening the print window.
- Embed the data URL in the HTML, size it by aspect ratio (fixed height, auto width) instead of a bare height.
- Replace the 300 ms timer with a wait for the print document's images (same pattern already used in `wofbi-report-export.js`), with a safety timeout.
- Do the same for the dean signature image, which has the identical problem.

### 3. Course Final Report print + Word
- Convert `report.cover.logo_url` to a data URL at export time (both print and `.docx`) so Word embeds real bytes and print never races the network.
- If the logo can't be fetched, show a toast telling the user the logo was skipped rather than failing silently.

### 4. Server-side statement PDF
- Port the tolerant template matching from `src/lib/certificate-template-lookup.js` into the edge function so `certificate_templates` is found despite naming drift between `exam_titles.name` and `training_type`.
- Sign private `church-documents` URLs with the service-role client before fetching the image.
- Preserve the logo aspect ratio in `buildStatementPdf` (read intrinsic dimensions, fit inside a max box) instead of forcing 28×28 mm.

## Verification

Print a Statement of Result and the Course Final Report, and download the report as Word, for a course whose certificate template has a WOFBI logo — confirm the logo appears with correct proportions in all three, plus in the emailed/stored server-generated statement PDF.
