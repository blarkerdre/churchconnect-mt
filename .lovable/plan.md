# Training Report: recorder name + timestamps

Add a "Recorded by" dropdown to the Record/Edit Training Session form and show when each session record was created/updated.

## What changes

### Record Session form
- New "Recorded by" dropdown listing users in the current church (name, falling back to email), defaulting to the person currently signed in.
- Saved on both new sessions and edits, so a correction keeps the right recorder.

### Session Records table
- New "Recorded by" column showing the selected person's name.
- New "Recorded on" column showing the creation date and time in the standard format `14 Aug 2026, 14:13`; if the record was later edited, the row shows a small "edited <date, time>" hint under it.
- Columns are hidden on narrow screens so the table still fits; on mobile the recorder and timestamp appear as small text under the session type.

### Exports
- CSV export gains "Recorded by" and "Recorded on" columns.
- Printed report gains a "Recorded by" column and shows the recorded date/time.

## Technical notes

- `training_reports.recorded_by` (uuid) and `created_at` / `updated_at` already exist and are already selected by the page query — no schema change needed.
- Populate the dropdown from `profiles` scoped to the current tenant (same pattern used elsewhere for assignee pickers), building an id → name map for table/CSV/print rendering.
- Default `form.recorded_by` to `user?.id` in `emptyForm` and in `openEdit` use `r.recorded_by || user?.id`; include it in both the insert and update payloads (currently `recorded_by` is only set on insert and never shown).
- Use the existing `formatDateTime` helper in `src/lib/utils.js` for the `dd MMM yyyy, HH:mm` format.
- File touched: `src/pages/TrainingReports.jsx`.
