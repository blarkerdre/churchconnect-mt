## Goal

Make the Bible School **Course Final Report** open pre-filled with the wording from the Cardiff WOFBI BCC template, pull striking testimonies from the course Feedback Form, use the same logo as the Statement of Result, and lay the report out with the same tables as the template.

## 1. Prefilled editable text from the template

Extend `src/lib/wofbi-report-defaults.js` so a brand-new report already contains the template's standard prose (all still editable):

- Cover defaults: "WORD OF FAITH BIBLE INSTITUTE", centre name, course title/code, edition, date range.
- Introduction: the three-paragraph template introduction, with course/edition placeholders filled from the selected course and session.
- Faculty: placeholder coordinating-team and volunteer lines to edit.
- Induction / class attendance / statistics sentences in the template's phrasing.
- General findings: the nine template paragraphs (attendance, registration, class breaks, mobile phones, post-induction reminders, marking & grading, class coordinator, graduation, summary) — already present, refined to match the template wording, plus the "overall performance" line.
- Next session note.

Existing saved reports are untouched; defaults only apply where a field is empty.

## 2. Striking testimonies from course feedback

Replace the current source (`testimonies` table) with the Bible School feedback form:

- Read `wofbi_feedback_responses` for the selected course (and session where available), take the `testimony` answer.
- Student name from the response's `first_name` / `surname` answers, falling back to the linked member's name.
- Heading defaults to "Testimony at Bible School" and stays editable, as in the template (each testimony has a bold heading, body, and student name).
- Only responses with non-empty testimony text are included; "Refresh from data" repopulates without wiping manual edits already made.
- Statistic 5a "Testimonies Recorded" counts these feedback testimonies instead of the global testimonies table.

## 3. Logo

Use the exact same resolution chain and timing as the Statement of Result: `certificate_templates.wofbi_logo_url` → `crest_image_url` → `logo_url` → tenant logo, looked up live by course name whenever the report is opened, previewed, printed or exported — not only when "Refresh from data" is pressed. The Logo URL field stays as a manual override; when it is blank the live value is used.

## 4. Tables as in the template

Rework the print/Word output in `src/lib/wofbi-report-export.js` so each section renders as the template's table rather than lists where a table is used:

- Section 7 — Courses & lecturers: S/N | COURSE | CODE | LECTURERS
- Section 10 — Student feedback: LECTURER | COURSE | QC PERSONNEL | RATINGS (quality control rating and student average rating in one cell, numbered as in the template)
- Section 11 — Quality control: LECTURER | COURSE | QC PERSONNEL | GENERAL OBSERVATIONS
- Section 13 — Honorarium recommendation: S/N | COURSE | CODE | LECTURERS | TYPE | REMARKS
- Honorarium matrix: S/N | APPROVED LECTURERS | NO. OF COURSES | RECOMMENDED HONORARIUM (£rate PER COURSE) | SIGNED CONTRACT OF SERVICE (COS)/PAYROLL
- Statistics 5a/5b keep the template's lettered/plain line format.

Header styling, uppercase headings and numbering follow the template. Tables avoid breaking across pages when printed, and the on-screen editor keeps its mobile-friendly stacked rows down to 384px.

## Technical notes

- Files touched: `src/lib/wofbi-report-defaults.js` (template defaults + testimony helper), `src/lib/wofbi-report-export.js` (table rendering, logo), `src/components/exams/CourseReportTab.jsx` (feedback-based testimonies, live logo lookup, defaults on new report).
- No database changes needed: `wofbi_feedback_responses` and `certificate_templates` already hold everything required, and all queries stay tenant-scoped with explicit `tenant_id` filters.
- All dynamic text continues to pass through the existing `escHtml` escaping in the export.
