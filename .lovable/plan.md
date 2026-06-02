## Why "Reports Officer" is missing from the Edit Member dialog

The User Management page lists `reports_officer` as an assignable role, but the role picker inside the Edit Member dialog has its own hardcoded list that was never updated when the Reports Officer role was added.

### Root cause

`src/components/members/MemberFormDialog.jsx` (around line 763) defines a local `ROLES` array:

```js
const ROLES = ["admin", "unit_leader", "wsf_leader"];
```

It also has local `roleIcons`, `roleColors`, and an inline label map that don't know about `reports_officer`. Because this list is what renders the assignment checkboxes, Reports Officer never appears.

### Fix

Update the User Roles block in `MemberFormDialog.jsx` only (no schema/business-logic changes):

1. Add `"reports_officer"` to the local `ROLES` array.
2. Add `reports_officer: FileText` (lucide icon, already used in `UserManagement.jsx`) to `roleIcons`.
3. Add `reports_officer: "bg-chart-2/10 text-chart-2"` to `roleColors`.
4. Update both display spots (Badge label and Checkbox label) so `reports_officer` renders as `"Reports Officer"` — extend the existing ternary that already special-cases `wsf_leader` → "Home Cell Leader".
5. Import `FileText` from `lucide-react` at the top of the file.

Permissions stay as they are: Reports Officer is a non-admin role so any tenant admin can assign/unassign it (existing `canChange` logic already permits non-admin roles for admins).
