# Remove Super Admin from the member profile role pickers

## Why
`super_admin` is a global, tenant-less role. The member edit dialog runs inside a tenant, so granting it here would (a) duplicate the new **Tenant Admin → Platform Users** tab, and (b) try to write a tenant-scoped `super_admin` row, which the hardened DB constraint now rejects. It also contradicts the rule we just enforced in `UserManagement.jsx`.

## Change (UI only, frontend)
File: `src/components/members/MemberFormDialog.jsx`

1. **"Also create user account" role Select (line 591)** — remove the `super_admin` option entirely. Keep the `admin` option gated by `isSuperAdmin` (tenant-scoped admin is still valid here).

2. **"User Roles" checkbox grid (lines 735, 742)** — drop `super_admin` from the `ROLES` array so it never appears as a toggle. Leave `roleIcons` / `roleColors` entries in place (they're still used to render an existing super_admin badge if a global super admin is viewing their own profile, so the badge stays read-only).

3. No change to `availableRoles` logic beyond removing `super_admin` from the source list — the existing `admin` filter for non-super-admins stays.

## Out of scope
- `MyProfile.jsx` line 148 — read-only `isSuperAdmin` check, not a picker. Leave alone.
- DB / RLS — already hardened in the previous migration.
- The new Platform Users tab in Tenant Admin remains the only place to grant/revoke global super admin.

## Result
Editing a member never exposes Super Admin as an assignable role. Existing global super-admin badges still render. Granting/revoking super admin happens exclusively from Tenant Admin → Platform Users.
