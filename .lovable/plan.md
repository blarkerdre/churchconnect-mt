

## Remove "member" from User Roles Management

### Problem
The `ROLES` array includes `"member"`, but "member" is the implicit default state — any user without elevated roles is already a member. Having it as a toggleable role in User Management is misleading and serves no purpose.

### Changes

**`src/pages/UserManagement.jsx`**
- Remove `"member"` from the `ROLES` array (line ~14), leaving only: `["super_admin", "admin", "unit_leader", "wsf_leader"]`
- Keep the `roleLabels`, `roleIcons`, and `roleColors` entries for `member` since they're used to display "member" as the fallback badge when a user has no roles — that display logic stays
- In the Add User dialog's role selector, keep "member" as the default initial value but clarify it means "no elevated role" (or change the default to skip role assignment entirely)

**`src/components/members/MemberFormDialog.jsx`**
- Also remove `"member"` from the role checkboxes/select items in the member edit form's User Roles section, for consistency

### Result
Admins will only see actionable, privilege-granting roles (Super Admin, Admin, Unit Leader, Home Cell Leader) in the role management UI. Users with no roles still display as "Member" via the existing fallback badge.

