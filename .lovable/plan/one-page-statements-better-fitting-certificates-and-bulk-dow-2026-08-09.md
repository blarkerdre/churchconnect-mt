# One-page statements, better-fitting certificates, and bulk download

## Goals
1. A student's Statement of Result always fits on a single A4 page (screen preview, print, and generated PDF).
2. Certificate and statement content sits properly inside the page — no clipped names, overflowing course titles, or logos that break the layout.
3. Admins can bulk download or print statements and certificates for many students at once, as one merged PDF or as a ZIP of individual files.

## 1. Statement of Result — fit to one page

The generated PDF (`supabase/functions/_shared/statement-pdf.ts`) currently lays out at fixed sizes, so a course with many modules or a long church name pushes content onto a second page.

Changes:
- Measure the content before drawing: number of module rows, number of grade bands, presence of logo/signature.
- Apply an auto-fit pass — reduce row height, table font size, header spacing and logo box within defined min/max bounds until everything fits between the top margin and the signature block on one page.
- Wrap long module titles and course names instead of letting them run past the right margin; truncate with an ellipsis only after two wrapped lines.
- Anchor the signature block to a fixed distance from the page bottom so the notes section shrinks rather than the signature spilling over.
- Guarantee a hard single-page result: whatever the content, only one page is ever added.

The browser print sheet in `src/components/exams/StatementOfResult.jsx` gets the same treatment — a fixed A4 page box with a scale factor computed from the row count, `page-break-inside: avoid`, and the same wrapping rules — so the printed output matches the PDF.

## 2. Certificate and statement layout fit

- Certificate SVG (`supabase/functions/issue-certificate/index.ts`): shrink the name and course-title font sizes automatically when the text is long, so they stay inside the 842x595 landscape canvas; keep logo, crest and signature images inside their boxes with correct aspect ratio.
- On-screen previews (`StatementPreview`, certificate preview dialogs): constrain to a page-proportioned container so what's on screen matches what prints, and keep them scrollable/readable at 384px wide.

## 3. Bulk download / print

**Statements — Bible School course results** (`src/components/exams/CourseResultsView.jsx`)

The table already supports selecting students. Add two actions to the existing selection toolbar:
- "Merged PDF" — one PDF, one page per selected student, opens/downloads for printing in one go.
- "ZIP" — a ZIP of individual statement PDFs named by student.

Backed by a new edge function `render-statements-bulk` that reuses the existing statement builder per student, either appending pages into one document or zipping the individual files. Admin-only, tenant-scoped, same permission checks as `render-statement-pdf`.

**Certificates — Certificates Report** (`src/pages/CertificatesReport.jsx`)

- Add row checkboxes plus select-all on the filtered certificate list.
- "Merged PDF" — each selected certificate image placed on its own landscape A4 page.
- "ZIP" — the original certificate images, named by certificate number.

Both built client-side from signed URLs of the already-stored certificate files (JSZip is already used in this project), so no re-rendering of certificates is needed.

Progress feedback: a counter toast while generating ("12 of 40"), and a clear message listing students skipped because they have no results / no issued certificate.

## Technical notes
- New edge function: `supabase/functions/render-statements-bulk/index.ts`, reusing `_shared/statement-pdf.ts` and `_shared/generate-statement.ts` data loading; jsPDF supports multi-page output natively.
- Limit each bulk request to a safe batch size (e.g. 50 students per call) and chunk larger selections client-side to stay within edge function time limits.
- No database schema changes required.
