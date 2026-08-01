## Goal

Make the Bible School **Course Final Report** print with its tables intact, make the Word download actually save a file (including on mobile), and pre-fill the editable statistics from Bible School applications and registrations.

## 1. Diagnose the export failure first

The current export opens a pop-up window (`window.open("", "_blank", "width=1000,height=800")`) and immediately calls `print()`, and the Word file is a `<a download>` blob. Both of these are commonly blocked in mobile browsers and installed PWA windows (the current session is a 384px viewport), which matches "nothing downloads" and a partially-rendered print. That cause is **not yet confirmed** — the first step is to reproduce the print and Word actions in the preview and read the console/network output, then apply the fixes below.

## 2. Rework print / PDF

In `src/lib/wofbi-report-export.js`:

- Render the report into a hidden same-document `<iframe>` and print from it instead of a pop-up, so no pop-up blocker is involved.
- Wait for the document (and the logo image) to finish loading before calling `print()`, so tables and the logo are laid out before the print snapshot.
- Keep a pop-up window path as a fallback if the iframe print isn't supported.
- Print CSS fixes so tables survive PDF output: `table { page-break-inside: auto }` with `tr { page-break-inside: avoid }`, repeated `<thead>` on page breaks, explicit borders under `-webkit-print-color-adjust: exact` (header fill currently disappears when browsers drop background colours in PDF).

## 3. Rework the Word download

- Emit a proper Word-openable HTML document (Word namespace header + `Content-Type: application/vnd.ms-word`), filename `.doc`.
- Use the anchor-download path, and when the browser blocks it (mobile Safari / standalone PWA) fall back to opening the document in a new tab so the user can save/share it, with a toast telling them what happened.
- Same table markup as the print output so both match the template.

## 4. On-screen preview

Add a "Preview" button next to Print/Word that shows the fully rendered report (same HTML, tables and all) in a scrollable dialog. This gives an immediate way to confirm the tables are being produced, independent of the browser's print pipeline.

## 5. Editable statistics from applications & registrations

Extend "Refresh from data" in `src/components/exams/CourseReportTab.jsx` so the statistics block is filled from real records (all values stay editable):

- **5b Registration statistics** — forms received from `wofbi_applications` for the course, registered & confirmed from approved `course_registrations`, completed from exam attempts across all subjects, absentees computed as registered minus attended rather than defaulting to 0.
- **5a Statistics** — water baptised and Holy Ghost baptised counted from the registered students' member records (`members.water_baptism`, `members.holy_spirit_baptism`), new birth counted from students whose membership status is New Convert, testimonies from the course feedback responses (already in place).
- **Nations** — keep the current nationality tally, but fall back to the nationality answer captured on the application when the member record has none.
- Statistics also seed automatically the first time a brand-new report is opened for a course, so the report isn't empty before the user presses Refresh.

## Technical notes

- Files touched: `src/lib/wofbi-report-export.js` (iframe print, Word document generation, print CSS), `src/components/exams/CourseReportTab.jsx` (preview dialog, expanded autofill, seed on first open).
- No database changes: `wofbi_applications.answers`, `course_registrations`, and the `members` baptism/status columns already hold everything needed; all queries keep their explicit `tenant_id` filters.
- All dynamic text keeps passing through the existing `escHtml` escaping.
