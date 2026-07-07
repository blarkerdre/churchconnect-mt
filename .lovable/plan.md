Tune the Statement of Result header to match the attached WoFBI Cardiff reference. Everything else (logo upload, centre name, per-course letter bands) is already in place from the previous change — this is layout polish only, no schema changes.

## Reference vs current

| Element | Reference | Current | Change |
|---|---|---|---|
| Logo | WOFBI crest, centered, ~140px | Uses `wofbi_logo_url` at h-16 (~64px) | Enlarge to ~140px height |
| Church name | Big bold black wordmark ("WORD OF FAITH BIBLE INSTITUTE") | `text-lg font-black` | Bump to `text-2xl` on-screen, ~26px in print |
| Centre name | Medium bold, prominent line ("CARDIFF LEARNING CENTRE") | `text-xs font-semibold` | Bump to `text-sm font-bold` (same weight as STATEMENT OF RESULT lines) |
| "STATEMENT OF RESULT" / course line | Same medium bold size | Already matches | No change |
| Diagonal "WOFBI" watermark | Present | Absent | Add optional watermark (uses `centre_name`-adjacent branding — actually renders the short brand code) — behind a template opt-in |
| Explanatory Notes bands | "A* -90-100" style | "A+  90-100" | Already customisable per course; no code change |

## Scope of edit

Frontend only, `src/components/exams/StatementOfResult.jsx`:
- On-screen preview: increase logo height (h-24), church name (`text-2xl font-black`), and centre name (`text-sm font-bold uppercase tracking-wide`).
- Print HTML: logo `height:130px`, church name `font-size:30px`, centre name `font-size:16px; font-weight:bold; margin-top:8px`.
- Add a subtle diagonal watermark to the print view when `template?.wofbi_logo_url` is set: a fixed grey "WOFBI" text at ~45° behind the table body. Skipping on-screen (dialog is small).

## Out of scope

- No schema changes (all fields already exist).
- No changes to grade-utils, CourseResultsView, or CertificateTemplateSettings.
- Not changing signatory rendering.
- Not attempting to auto-populate church_name / centre_name — admin sets them once in Certificate Templates.

## Verification

Playwright headless render of the seeded WCI Cardiff BCC statement after setting church_name + centre_name + WoFBI logo → screenshot saved to `/mnt/documents/wci-cardiff-statement-v2.png` and shown as an artifact for side-by-side comparison with the reference.