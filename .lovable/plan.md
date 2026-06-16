## Inventory — refined access tiers

Introduce two permission levels on the Inventory page:

- **View + Inspect (any Church Office member, admins, super admins)** — can open the page, browse items, run inspections, view inspection history.
- **Manage + Report (Church Office unit *leader* only, plus tenant admins / super admins)** — can add/edit/delete items, add/edit/delete categories, and generate the inventory report.

### Changes

**`src/pages/Inventory.jsx`**

1. Add a new permission flag alongside `isOfficeMember`:
   - Read `leaderUnits` from `useAuth()` and compute `isOfficeLeader = leaderUnits.some(u => u.toLowerCase() === "church office")`.
   - Keep `canAccess = isAdmin || isSuperAdmin || isOfficeMember || isOfficeLeader` for the page-level gate (`Navigate` redirect uses this).
   - New `canManage = isAdmin || isSuperAdmin || isOfficeLeader` for management actions.
2. Gate buttons on `canManage`:
   - Header "Add Item" button.
   - "Add Category" button on the Categories tab.
   - Edit (pencil) and Delete (trash) buttons on item cards and category cards.
   - The "No items yet. Click Add Item to begin." empty-state copy changes to a neutral message when `!canManage`.
3. Add a new **"Generate Report"** button (gated on `canManage`) in the header next to Add Item:
   - Opens print view via existing `PrintReportButton` pattern (or `window.print` wrapper) rendering a printable report containing:
     - All items grouped by category (name, location, serial, condition, last inspected, next due).
     - "Due / Overdue inspections" section.
   - Uses `escHtml` for any dynamic strings (project XSS rule).
4. Keep the data queries enabled whenever `canAccess` is true (currently gated on `canManage`), so plain office members can load items/categories for viewing and inspecting.

**`src/components/AppLayout.jsx`**

- Sidebar Inventory entry visibility: keep current `isAdmin || isSuperAdmin || isChurchOfficeMember` (already covers leaders since leaders are members of the unit). No change needed.

### Non-changes

- No DB / RLS changes — existing tenant-scoped policies on `inventory_*` already cover writes; the new restriction is UI-level gating layered on top.
- `app_settings` row for `inventory.church_office_unit` remains unused (kept as-is).
- Inspection writes (`inventory_inspections`, `inventory_inspection_responses`) stay available to office members because they need to run inspections.
