# Send Statement of Result as a downloadable file

## Why not a true email attachment
Lovable's email queue does not support file attachments. The equivalent, and what other statements/certificates in this app already do, is to generate the file, store it, and email a link. The link opens the same document the admin/member sees on screen.

## What the recipient will get
- A short branded email (subject: "Statement of Result: {Course Name}") with the student's name, course, session, overall classification, and one primary button: **Download Statement of Result (PDF)**.
- A secondary link: **View in your profile**.
- The PDF itself is a pixel-faithful copy of the on-screen/printable Statement of Result (formal WOFBI layout — church header, logo, watermark, student number, session label, Module | Grade table, explanatory notes, signatory).

## Where the PDF comes from
A new Edge Function `render-statement-pdf` will build the same HTML that `StatementOfResult.jsx` prints (church/centre/logo, student number derivation, session lookup, letter bands from `resolveLetterGradeBands(course)`, signatory) and render it to PDF. Rendering approach:

- Use a Deno-compatible HTML→PDF service. Two viable options:
  1. `npm:@sparticuz/chromium` + `npm:puppeteer-core` — heavy but exact.
  2. `npm:html-pdf-node` / `npm:pdfmake` — lighter but not pixel-identical.
- Recommended: build the PDF **server-side with `pdfmake`** (pure JS, works in Deno via `npm:pdfmake`), reproducing the layout with pdfmake primitives instead of HTML. Deterministic, fast, no Chromium.

If you'd rather keep the exact HTML/CSS, we can switch to the Chromium option — it costs more cold-start time but guarantees the print view and the PDF are byte-identical in appearance.

## Storage
- New private bucket `exam-statements` (create if missing).
- Path: `{tenant_id}/{course_id}/{member_id}/{yyyymmdd-hhmmss}-statement.pdf`.
- Email link is a **signed URL** valid for 30 days (long enough for the recipient to download, short enough not to leak forever).
- RLS/policies: bucket is private; only admins and the member themselves can read. Signed URL bypass is intentional for email recipients.

## Changes

### New Edge Function `supabase/functions/render-statement-pdf/index.ts`
- Auth: admin in tenant (same check as `send-statement-email`).
- Input: `{ tenant_id, course_id, member_id }`.
- Loads member, course, subjects, best attempts, session, registration, certificate template — same queries as `StatementOfResult.jsx` and `send-statement-email`.
- Uses `resolveLetterGradeBands(course)` semantics (course-level bands only) so letters match the UI, not per-subject bands.
- Builds PDF via `pdfmake` and returns `{ path, signed_url, expires_at }`.

### Update `supabase/functions/send-statement-email/index.ts`
- Before enqueuing, invoke `render-statement-pdf` (or inline the render if we keep it in one function) to get `signed_url`.
- Replace the current 5-column results table + "PASSED/NOT YET PASSED" block with a compact summary card:
  - Student name, course, session
  - Overall classification (course-level bands, matching the UI)
  - **Download Statement of Result** button → `signed_url`
  - **View in your profile** link
- Fix the letter-band mismatch: use `resolveLetterGradeBands(course)` (course-level), matching the UI.
- Keep unsubscribe token + `email_send_log` behavior unchanged.

### New shared module `supabase/functions/_shared/statement-pdf.ts`
- Exports `buildStatementPdf(input)` returning a `Uint8Array`.
- Layout mirrors `StatementOfResult.jsx`:
  - Header: logo/crest, church name, centre name, "STATEMENT OF RESULT", `{COURSE NAME} {SESSION LABEL}`.
  - Name row: `NAME: {member.name}` on the left, student number underlined on the right (derives if not stored, exactly like the UI: `TENANTCODE/COURSECODE/MONTH/YEAR/SEQ`).
  - Watermark: rotated "WOFBI" for Bible School courses (skip for non-Bible-School courses so the footer/watermark stops being hardcoded).
  - Modules table: `Module Title | Grades` (letter only), overall row shows `Overall Result: {classification}`.
  - Explanatory notes table from `resolveLetterGradeBands(course)`.
  - Signatory block: signature image, name, title.

### Storage bucket
- Migration creates bucket `exam-statements` (private) if missing.
- Policies: `authenticated` can `SELECT` own paths (`tenant_id` prefix match) + admins can select all in their tenant; service role has full access. Signed URLs are used for email recipients regardless.

### Frontend (optional, same layout)
- Add a **Download PDF** button in `StatementOfResult.jsx` next to Print/CSV that calls `render-statement-pdf` and triggers a download, so the admin/member can grab the same file the email links to.

## Verification
1. Deploy `render-statement-pdf` and `send-statement-email`.
2. From Exam Management, send Romoke's statement.
3. Confirm:
   - Email arrives with the new compact body + working **Download** button.
   - Downloaded PDF matches the on-screen Statement of Result (letters, classification, student number, session, signatory).
   - `email_send_log` row `sent`, `exam-statements` bucket has the PDF at the expected path.
4. Signed URL still opens after admin logs out (bucket private + signed URL works for email recipients).

## Open question
Do you want the PDF rendered with **pdfmake** (fast, layout re-created in JS — recommended) or with **headless Chromium** (byte-identical to the print view, slower cold starts)?
