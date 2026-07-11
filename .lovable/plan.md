## Goal
Let admins filter Bible School applications by answers to the dynamic form fields (e.g. gender = Male AND marital status = Married) so they can produce targeted lists like "registered married men" — and include those filters in the report and CSV exports.

## Scope
Change is limited to `src/components/exams/WoFBIApplicationsTab.jsx`. No schema, RLS, or public form changes.

## What the user will see

1. **New "Answer filters" row** below the existing Status/Course/Date filters:
   - A "+ Add filter" button opens a small popover: pick a form field, then pick a value.
   - Supported field types (from the dynamic form):
     - `select` / `radio` → value dropdown from the field's options.
     - `checkbox` (single boolean) → Yes / No.
     - `multiselect` / checkbox groups → "includes" value dropdown.
     - `text` / `textarea` / `email` / `phone` / `number` / `date` → "contains" text input (number/date get equals).
   - Each active filter shows as a removable chip: `Marital status: Married ×`. Multiple chips combine with AND.
   - Chips participate in "Clear filters" and the "X of Y shown" counter.

2. **Report panel** already summarises the filtered set, so applying "Gender = Male" + "Marital status = Married" instantly gives counts, status breakdown, top courses, and month-on-month for that cohort. No new stat cards needed.

3. **Exports** already read from `filtered`, so:
   - "Export CSV" produces the row-level list for the cohort (e.g. married men).
   - "Export report" produces the summary for the cohort.
   Filenames get a short suffix when answer filters are active, e.g. `bible-school-applications-filtered-2026-07-11.csv`.

4. **Empty state** message updated to mention answer filters when they're the reason nothing matches.

## Technical notes

- Read field metadata from the already-loaded `form.fields`. Skip `section_heading`.
- New state: `answerFilters: Array<{ id, fieldId, op, value }>` where `op ∈ {"equals","contains","includes","boolean"}` chosen from field type.
- Extend the existing `filtered` `useMemo` with an AND pass over `answerFilters`, reading `a.answers?.[fieldId]`. Case-insensitive `contains` for free-text; strict equality for select/radio/boolean; `Array.isArray(v) && v.includes(value)` for multi-select.
- `hasFilters` and `clearFilters` include `answerFilters`.
- Popover uses existing shadcn `Popover` + `Select` + `Input`; no new deps.
- Selection state (`selectedIds`) is cleared when answer filters change to avoid acting on hidden rows.
- All logic stays client-side over the already-fetched applications list — same tenant scoping, same permissions, no new queries.

## Out of scope
- Saving filter presets.
- Server-side querying by JSON answers.
- Charts beyond existing stat cards.
- Editing form answers.
