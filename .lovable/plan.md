
## Goal

Three changes to the Statement of Result, all opt-in / per-tenant / per-course so nothing changes for tenants that don't configure them:

1. **WoFBI logo** — configurable per tenant (falls back to current tenant logo).
2. **Centre line** (e.g. "Cardiff Learning Centre") — configurable per tenant, placement will match the reference document once re-attached.
3. **Alphabet grade bands** — customisable per course (same pattern as `grade_classifications`), with the current WOFBI bands as the default.

> Note: no document is attached in the current message. I'll implement the header layout to match the current statement, and once you re-attach the WoFBI reference I'll fine-tune placement of "Cardiff Learning Centre" and the WoFBI logo in a follow-up pass. If you'd like exact fidelity first, re-attach it and I'll incorporate before implementing.

## Schema changes (migration)

**`certificate_templates`** — add two nullable columns:
- `wofbi_logo_url text` — tenant's WoFBI logo (used on Bible School statements instead of the generic tenant logo).
- `centre_name text` — e.g. "Cardiff Learning Centre". Shown under the WoFBI header block.

Applied per tenant + `training_type` (row already exists per Bible School course), so a tenant can, in principle, set different centre names per course. In practice we'll surface it once in the certificate template settings UI for the Bible School courses.

**`exam_titles`** — add one nullable column:
- `letter_grade_bands jsonb` — array of `{ letter, label, min, max }` objects. `null` means "use platform default" (current `LETTER_GRADE_BANDS`).

No RLS/GRANT changes — both tables already have policies.

## Frontend changes

**`src/lib/grade-utils.js`**
- Keep `LETTER_GRADE_BANDS` as the default export.
- Add `getLetterGrade(percentage, bands)` — accept an optional `bands` override, fall back to default.
- Add `resolveLetterGradeBands(course)` helper that returns `course.letter_grade_bands || LETTER_GRADE_BANDS`.

**`src/components/exams/StatementOfResult.jsx`**
- Fetch `certificate_templates.wofbi_logo_url` and `centre_name` in the existing template query.
- Header:
  - If `wofbi_logo_url` set → render it as the main logo (replaces the current `crest_image_url`/`logo_url`/`tenant.logo_url` fallback chain for Bible School statements).
  - If `centre_name` set → render it as a distinct line in the header block. Exact placement will be tuned to the WoFBI document once re-attached; default is directly under the church name, above "STATEMENT OF RESULT".
- Row rendering + Explanatory Notes: use `resolveLetterGradeBands(course)` instead of the imported constant. Print view too.

**`src/components/exams/CourseResultsView.jsx`** (course settings surface)
- In the "Grade classifications" editor area, add a second editor: **Letter grade bands** with columns Letter / Label / Min % / Max %.
- Persists to `exam_titles.letter_grade_bands`. "Reset to defaults" button sets column back to `null`.

**`src/components/certificates/CertificateTemplateSettings.jsx`**
- Add two fields to the Bible School (WOFBI) template row:
  - **WoFBI logo** (upload → same storage bucket the other cert images use, stored in `wofbi_logo_url`).
  - **Centre name** (text input, stored in `centre_name`, placeholder "Cardiff Learning Centre").

## Out of scope

- No changes to `course_registrations`, reference-number format, or the CSV export.
- No changes to certificates themselves (only Statement of Result); we can mirror the WoFBI branding on the printed certificate in a follow-up if wanted.
- No re-styling of the whole statement layout — just header + configurable bands. Exact WoFBI header treatment awaits your re-attached document.

## Verification

1. WCI Cardiff: upload WoFBI logo + set centre name "Cardiff Learning Centre" → re-render the seeded BCC statement via Playwright and screenshot to `/mnt/documents/`.
2. Edit BCC letter bands (e.g. lower "Pass" to 35) → confirm one of the seeded scores changes letter grade in the rendered statement.
3. A different tenant with no WoFBI logo / no centre name / no custom bands → confirm the statement renders unchanged.
