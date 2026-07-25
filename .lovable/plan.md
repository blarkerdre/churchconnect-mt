## Goal
In `src/pages/Attendance.jsx`, when creating a "Home Cell Meeting", the Home Cell Centre field currently renders a free-text `Input` for admins/non-WSF-leaders. Replace it with a dropdown of Home Cell centres, mirroring how the Unit dropdown works for Unit Meetings.

## Changes (frontend only, `src/pages/Attendance.jsx`)

1. Add a query to fetch centres from `wsf_centres` scoped to the current `tenant_id`:
   - For admins: fetch all centres (active + inactive), show a "Hidden" badge next to inactive ones (same pattern used for hidden units).
   - For non-admins: fetch only `is_active = true` centres.
   - Order by `name`.

2. In the Home Cell Centre block (around lines 567–585), replace the `else` branch's `<Input>` with a `<Select>`:
   - Options come from the centres query.
   - Placeholder: "Select a Home Cell centre".
   - Value bound to `form.unit`, same `onValueChange` handler.
   - For admins, append a small "Hidden" badge in `SelectItem` when the centre is inactive.

3. Leave the WSF-leader branch (single centre auto-fill / limited leader-centres select) unchanged.

4. No DB, RLS, or edge function changes. No changes outside this file.

## Verification
- As admin: open "Create Meeting" → select "Home Cell Meeting" → see dropdown listing all centres, hidden ones badged.
- As WSF leader: behavior unchanged.
- As unit leader / member without WSF role: dropdown shows only active centres.
