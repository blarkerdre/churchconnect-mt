# Plan: Search in Pickup + Filters in Report

## Pickup panel (`PickupPanel` in `src/pages/ChildrenChurch.jsx`)
- Add a search `Input` above the "Currently in care" list with a Search icon.
- Filter `inCare` client-side by child first/last name (case-insensitive substring match). No DB changes — list is already loaded.
- Show "No matches" hint when search has a value but the filtered list is empty.

## Report panel (`ReportPanel` in same file)
Existing filters: From / To dates only.

Add three more filters in the same toolbar row:
1. **Age group** — `Select` populated from the `children_age_groups` app setting (via existing `useAppSetting`), plus an "All" option.
2. **Child name** — text `Input` with placeholder "Search child…".
3. **Status** — `Select` with All / checked_in / picked_up / flagged (small bonus, common ask alongside name/age filters).

Apply all three client-side over `rows` via a `useMemo` `filteredRows`:
- name: case-insensitive substring on `first_name + " " + last_name`
- age group: exact match on `children.age_group`
- status: exact match on `r.status`

Use `filteredRows` (not `rows`) for:
- the stats `useMemo`
- the CSV download (file name keeps date range)
- the table body & "No records" empty state
- the CSV/disabled check

Add a small muted "Showing X of Y" counter next to the toolbar when filters are active.

## Out of scope
- No DB changes, no new columns.
- No changes to drop-off/check-in logic.
- No changes to report export columns.
