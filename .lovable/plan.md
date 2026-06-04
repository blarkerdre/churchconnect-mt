## Goal
When a Reports Officer opens Members (from the Reports Hub), only the AudienceFilter and the members table should be visible. All action buttons and the search box should be hidden.

## Changes — `src/pages/Members.jsx`

1. **Hide top controls bar for Reports Officer (non-admin):**
   - Wrap the entire top controls `<div class="flex flex-col sm:flex-row ...">` (Search input + QR/CSV/Import/Register buttons) so it does not render when `isReportsOfficer && !isAdmin`.
   - This removes the Search box and any action buttons for Reports Officers.

2. **Keep AudienceFilter visible** — current condition `(isAdmin || viewOnly)` already includes Reports Officer; no change.

3. **Keep stats cards** — current condition `(isAdmin || viewOnly)` already shows them.

4. **Row actions dropdown:**
   - For Reports Officer (non-admin), render no menu items (Edit/Issue Certificate/Delete are already gated off). Show a single disabled "View only" item, and optionally hide the trigger button entirely for Reports Officer to keep the table clean.
   - Simpler: hide the entire Actions cell (trigger + dropdown) for `isReportsOfficer && !isAdmin`, and drop the Actions column header for them; adjust the empty-state `colSpan` accordingly.

## Out of scope
- No changes to other Reports Hub modules.
- No backend/RLS changes.
- No changes to admin/owner/unit-leader views of Members.
