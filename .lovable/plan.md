## Problem

The Members page has a Home Cell dropdown in `AudienceFilter` (`wsfCentreId`), but the members list ignores it. `src/pages/Members.jsx` only checks `status`, `unit`, `dateFrom`, `dateTo`, and `account` when filtering — `wsfCentreId` is dropped, so selecting a Home Cell has no effect.

## Fix

**`src/pages/Members.jsx`**
- Add `wsfCentreId: "all"` to the initial `filters` state.
- In the `filtered` computation, add:
  `const matchWsfCentre = filters.wsfCentreId === "all" || m.wsf_centre_id === filters.wsfCentreId;`
  and include it in the final `&&` chain.

**`src/components/comms/AudienceFilter.jsx`** (consistency with the earlier "admin can see hidden Home Cells" work)
- Drop the `.eq("is_active", true)` restriction on the `wsf_centres` query so admins can filter members by hidden centres too. RLS already hides non-admin access.
- Optionally label hidden centres as `"{name} (Hidden)"` in the dropdown for clarity.

No database or other component changes needed.