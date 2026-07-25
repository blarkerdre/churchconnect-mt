## Root cause

The New Meeting dialog in `src/pages/Attendance.jsx` calls `useChurchUnits()` with the default `activeOnly = true`, so any church unit marked hidden (`is_active = false`) is stripped out before the Unit dropdown is rendered — even for Admins. That's why "not all units" appear.

Unit Tasks (`src/pages/UnitTasks.jsx`) already fetches every unit for Admins (no `is_active` filter), but the dropdown gives no visual clue when a unit is hidden.

## Changes

1. **`src/pages/Attendance.jsx`**
   - Replace `useChurchUnits()` with `useChurchUnits(!isAdmin)` so Admins receive both active and hidden units (same pattern used by `SessionFormDialog.jsx`).
   - In the Unit `<Select>` (line ~543) and the top-of-page unit filter (line ~252), render a small "Hidden" badge next to any unit where `is_active === false`, so Admins can tell them apart.

2. **`src/pages/UnitTasks.jsx`**
   - Fetch `is_active` alongside `name` in the `active-units-for-tasks` query for Admins and keep a set of hidden names.
   - Pass the hidden-name set (or an array of `{name, is_active}`) into `UnitTaskFormDialog` and `UnitTaskReportDialog` so their Unit dropdown items can display the same "Hidden" badge for Admins. Non-admin leaders/members are unaffected.

3. **`src/components/unitTasks/UnitTaskFormDialog.jsx`** and **`src/components/unitTasks/UnitTaskReportDialog.jsx`**
   - Accept the optional hidden-names set and, when present, render the "Hidden" badge inside each `<SelectItem>` (mirroring `SessionFormDialog.jsx`).

No RLS, schema, or business-logic changes — purely a frontend fix so Admins see and can pick hidden units, with a clear visual marker.

## Out of scope

- Non-admin users continue to see active units only.
- No change to how hidden units are toggled in Settings.
