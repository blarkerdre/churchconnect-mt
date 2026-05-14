## Goal

Add **Session** and **Date** filters to the course Registrations view (Exam Management → Course → Registrations), alongside the existing Search and Source filters.

## Where

`src/pages/ExamManagement.jsx` → `CourseRegistrationsView` (lines ~694–856). No DB or backend changes; data already includes `session_id`, `exam_sessions(name)`, and `registered_at`.

## Changes

1. **State**
   - `sessionFilter` (default `"all"`)
   - `dateFrom`, `dateTo` (ISO `yyyy-mm-dd`, default empty)

2. **Session dropdown**
   - Build options from distinct `{ id, name }` found in `registrations` (plus an "All Sessions" entry and a "— No session —" entry for legacy rows where `session_id` is null).
   - Place next to the existing Source `Select`.

3. **Date range**
   - Two compact `<Input type="date">` controls labelled "From" / "To" (keeps things simple on the 384px viewport, no extra deps).
   - Filter on `registered_at` ≥ from (00:00) and ≤ to (23:59:59).

4. **Filter logic** — extend `filteredRegistrations` to also apply session + date checks.

5. **CSV export** — already iterates `filteredRegistrations`, so it inherits filters. Append the active filter summary to the filename (e.g. `BCC_registrations_NewCohort_2026-01-01_to_2026-05-14.csv`) when filters are set.

6. **Empty-state copy** — update the "No registrations match…" message to mention filters generally (already generic enough — leave as-is).

7. **Responsive layout** — wrap the toolbar (search + source + session + dates + CSV) in a `flex-wrap gap-2` container so it stacks cleanly on the 384px mobile viewport.

## Out of scope

- No changes to how registrations are created.
- No changes to the database, RLS, or to `OpenSessionsPanel` / public registration pages.
- No changes to certificate generation.