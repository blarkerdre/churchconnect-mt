

## Add Unit Leaders Filter in User Management

### What already exists
- The role filter dropdown already includes "unit_leader" which filters to show only unit leaders
- The "Led Units" column already shows assigned units for unit leaders, but it's **hidden on screens smaller than `lg`** (`hidden lg:table-cell`)

### What to add

**1. `src/pages/UserManagement.jsx`** — Enhance the unit leaders filtering experience:
- Add a dedicated "Unit Leaders" quick-filter button next to the existing filters (a toggle chip/button) that sets `roleFilter` to `unit_leader` and ensures the units column is visible
- When the `unit_leader` role filter is active (either via dropdown or quick button), make the "Led Units" column **always visible** (remove the `hidden lg:table-cell` restriction)
- Add a count badge on the quick-filter button showing how many unit leaders exist

### Files changed
- `src/pages/UserManagement.jsx` — add unit leaders quick-filter button, conditionally show Led Units column on all screen sizes when filtering by unit_leader

