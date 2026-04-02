

## Replace Hardcoded Unit Lists with Tenant-Scoped `useChurchUnits` Hook

### Problem
Three components still use hardcoded `ALL_UNITS` / `UNITS` arrays instead of pulling from the tenant-scoped `church_units` database table. This means tenants who add or remove units in Settings don't see those changes reflected in unit leader assignments or attendance session forms.

### Fix

Replace the hardcoded arrays with the existing `useChurchUnits()` hook in three files:

#### 1. `src/components/users/UnitLeaderAssignments.jsx`
- Remove `ALL_UNITS` constant
- Import and call `useChurchUnits()`
- Derive unit names from `churchUnits.map(u => u.name)`

#### 2. `src/components/users/BulkUnitAssignDialog.jsx`
- Remove `ALL_UNITS` constant
- Import and call `useChurchUnits()`
- Use `churchUnits.map(u => u.name)` in the Select dropdown and assignment logic

#### 3. `src/components/attendance/SessionFormDialog.jsx`
- Remove `UNITS` constant
- Import and call `useChurchUnits()`
- Use `churchUnits.map(u => u.name)` for the unit options (both admin and unit leader paths)

### Files changed
- `src/components/users/UnitLeaderAssignments.jsx`
- `src/components/users/BulkUnitAssignDialog.jsx`
- `src/components/attendance/SessionFormDialog.jsx`

