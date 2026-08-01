## Cause

The "Word Export" button doesn't produce a Word file — it writes an HTML document with a `.doc` extension and a `application/vnd.ms-word` MIME type (`downloadReportDoc` in `src/lib/wofbi-report-export.js` reuses `buildReportHtml`). Since Microsoft's Office security update, Word blocks HTML-content files with Word extensions and shows "the file is corrupt and cannot be opened". Mobile Word and Google Docs reject them too. Nothing about the report content is wrong — the container format is.

## Fix: emit a genuine .docx

Build a real OOXML package client-side using `jszip` (already a project dependency, no new packages).

New file `src/lib/wofbi-report-docx.js`:
- Small OOXML helpers: `para(text, opts)` (bold / underline / heading / centred), `numberedList(items)`, `docxTable(headers, rows, widths)` with the navy header shading, borders and cell padding used in the print layout.
- `buildReportDocx(report)` walks the exact same report model as `buildReportHtml` and produces the same sections in the same order: cover block, 1 Introduction, 2 Faculty, 3 Induction, 4 Class attendance, 5a/5b statistics, 6 Nations, 7 Courses & lecturers, 8 Findings + overall performance + next session, 9 Testimonies, 10 Feedback intro + table, 11 QC table (with the 10-point checklist cell), 13 Honorarium + sub-heading + matrix, REMARK, sign-off.
- Package `[Content_Types].xml`, `_rels/.rels`, `word/document.xml`, `word/_rels/document.xml.rels`, `word/styles.xml` into a zip and return a `Blob` with the correct `.docx` MIME type.
- Cover logo: fetch the logo URL as bytes and embed it in `word/media/` with a relationship and a `w:drawing` inline image; if the fetch fails, skip the image and keep the rest of the document.
- Page size A4 with ~18mm margins, matching the print stylesheet.

`src/lib/wofbi-report-export.js`:
- Make `downloadReportDoc` async: build the blob via `buildReportDocx`, save as `<course>_report.docx`, keep the existing `"downloaded" | "opened" | "failed"` return contract and the popup/new-tab fallbacks for PWAs that block downloads.
- Keep `buildReportHtml` and `printReport` untouched — the on-screen Preview dialog and Print path continue to use the HTML renderer.

`src/components/exams/CourseReportTab.jsx`:
- `await` the now-async download call and keep the existing toast handling; relabel the button to "Download Word (.docx)".

## Technical notes

No schema or data changes. Text is XML-escaped and newlines split into separate paragraphs (Word rejects raw `\n` in a run), tables carry both `tblGrid` widths and per-cell widths so they render correctly in Word and Google Docs.

## Verification

Generate a .docx from a sample report in a headless browser run, unzip it, validate the XML, convert to PDF with LibreOffice and inspect every page image for broken tables, clipped text or missing sections before reporting done.
