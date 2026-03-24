

## Plan: Bridge Tenant Roles with Application Access

### Problem
Tenant `owner` and `admin` roles (stored in `tenant_memberships`) are disconnected from application-level roles (stored in `user_roles`). A tenant owner without an `admin` entry in `user_roles` cannot access most features (Members, Events, Settings, Analytics, etc.).

### Approach
Modify the `useAuth` hook to also check tenant membership roles, so that a tenant owner/admin is automatically treated as an app-level admin within their tenant context. This avoids duplicating role data across two tables.

### Changes

**1. Update `useAuth.jsx` — fetch tenant membership role**
- After fetching `user_roles`, also query `tenant_memberships` for the current user
- Expose a new `tenantRole` value (owner/admin/member) from the memberships
- Update the derived booleans (`isAdmin`, etc.) to include tenant role checks:
  - `isAdmin` = has `admin`/`super_admin` in `user_roles` **OR** has `owner`/`admin` role in `tenant_memberships`
- This ensures tenant owners/admins automatically pass all `AdminRoute`, `LeaderRoute`, and nav filtering checks

**2. Update `AppLayout.jsx` — role title display**
- Update `getRoleTitle()` to reflect tenant-derived admin status (e.g., show "Tenant Admin" or "Admin" for tenant owners/admins who don't have an explicit `user_roles` entry)

**3. Update route guards in `App.jsx`**
- No structural changes needed — the guards already use `isAdmin` from `useAuth`, which will now incorporate tenant roles

### Technical Details
- The `tenant_memberships` query in `useAuth` will fetch all memberships for the user: `SELECT tenant_id, role FROM tenant_memberships WHERE user_id = ?`
- The `isAdmin` derivation becomes: `roles.includes("admin") || roles.includes("super_admin") || tenantMemberships.some(m => m.role === "owner" || m.role === "admin")`
- `isTenantOwner` will also be exposed for owner-exclusive features
- No database migrations required — this is purely a frontend logic change
- The existing `is_admin()` RLS function only checks `user_roles`, so RLS policies will still gate data access separately. To fully bridge this at the DB level, we'd need to update `is_admin()` to also check `tenant_memberships` — this will be included as a migration

**4. Database migration — update `is_admin()` function**
- Modify the `is_admin` security definer function to also return `true` if the user has `owner` or `admin` role in `tenant_memberships` for any tenant they belong to
- This ensures RLS policies also respect tenant admin status

### Files Modified
- `src/hooks/useAuth.jsx` — add tenant membership fetch, update `isAdmin` derivation
- `src/components/AppLayout.jsx` — update role title logic
- New migration — update `is_admin()` database function

