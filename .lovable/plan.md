

## Add Explicit User Promotion for Super Admins in Tenant Admin

### Current State
The `TenantUsersDialog` already has a role dropdown (member/admin/owner) and the database RLS allows super admins to manage all tenant memberships. So **the capability technically exists** — a super admin can open Users on any tenant and change roles via the dropdown.

### What This Plan Adds
Make promotion more explicit and visible for super admins:

1. **Add a "Promote to Owner" quick action** in the `TenantUsersDialog` — a dedicated button with a Crown icon next to the role dropdown, visible only to super admins, that promotes a user to `owner` with one click (with confirmation).

2. **Add a "Promote to Admin" quick action** — similar button with Shield icon for promoting to `admin`.

3. **Super admin badge** — show a visual indicator in the dialog header when the current user is operating as a super admin (so it's clear they have elevated privileges).

4. **Guard against self-demotion** — prevent super admins from accidentally demoting themselves if they're also a tenant member.

### Technical Details

**File: `src/components/tenants/TenantUsersDialog.jsx`**
- Import `roles` from `useAuth()` and derive `isSuperAdmin`
- Add promote-to-owner and promote-to-admin icon buttons next to the role dropdown, with confirmation toast
- Show a `Badge` in the dialog header: "Super Admin Mode" when `isSuperAdmin` is true
- Reuse existing `updateRoleMutation` for the promotion action

### Files changed
- **`src/components/tenants/TenantUsersDialog.jsx`** — add explicit promote buttons and super admin indicator

No database changes needed — RLS already supports this.

