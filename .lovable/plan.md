## Allow tenant owners to grant app-level Admin from the member form

Currently, only super-admins can grant the `admin` app role in `MemberFormDialog`. Tenant owners can grant the `admin` *tenant* role (via tenant management) but cannot mint app-level admins from the member form. This plan unifies the two: a tenant owner gets the same authority as a super-admin when assigning app roles to members **within their own tenant**.

### 1. `src/components/members/MemberFormDialog.jsx` (UI gate)

Pull `isTenantOwner` from `useAuth()` and treat owner === super-admin for role-assignment UI:

- Line 55: add `isTenantOwner` to the `useAuth()` destructure.
- Add a derived flag: `const canAssignAdminRole = isSuperAdmin || isTenantOwner;`
- Line 618 (Create-account role select) — show the `Admin` option when `canAssignAdminRole` (not just `isSuperAdmin`).
- Line 768–769 (existing-member role checkbox grid):
  - `canChange = !isOwnAccount && (canAssignAdminRole || (!hasAdminRole && isAdmin))`
  - `availableRoles = canAssignAdminRole ? ROLES : ROLES.filter(r => r !== "admin")`

No other UI changes — the "Cannot change your own roles" and admin-protection logic stays identical.

### 2. `supabase/functions/admin-create-user/index.ts` (server gate)

Today (lines ~75–78) the check is:

```ts
if (role && ['admin', 'super_admin'].includes(role)) {
  if (!isSuperAdmin) return jsonResponse({ error: "Super-admin access required..." }, 403);
}
```

Split the two roles so tenant owners can mint `admin` for their own tenant, while `super_admin` stays super-admin-only:

```ts
if (role === 'super_admin' && !isSuperAdmin) {
  return jsonResponse({ error: "Super-admin access required to assign super_admin" }, 403);
}
if (role === 'admin' && !isSuperAdmin) {
  // Must be the OWNER of this tenant
  const { data: ownerRow } = await supabase
    .from("tenant_memberships")
    .select("role")
    .eq("user_id", caller.id)
    .eq("tenant_id", tenant_id)
    .maybeSingle();
  if (ownerRow?.role !== "owner") {
    return jsonResponse({ error: "Tenant owner or super-admin required to assign admin role" }, 403);
  }
}
```

The existing `isTenantAdmin || isSuperAdmin` check above still gates *access* to the function; this block only tightens the elevated-role assignment.

### 3. Role-update path (existing-member checkbox save)

`MemberFormDialog` applies staged role changes around line 415 by writing directly to `user_roles` through the supabase client. RLS on `user_roles` already allows tenant admins/owners (via the same `is_admin` RPC) to insert/delete rows scoped to their tenant, so the client-side write will succeed for owners once the UI lets them tick the box. No DB migration needed.

### Permission matrix after change

```text
Capability                         Owner   Admin   SuperAdmin
─────────────────────────────────────────────────────────────
Grant app-level Admin (member form)  ✓       ✗        ✓
Grant Unit / Home Cell Leader        ✓       ✓        ✓
Grant super_admin                    ✗       ✗        ✓
```

### Out of scope

- Tenant-level `admin` membership role (tenant management dialog) — unchanged.
- No changes to `useAuth` bridge, RLS, or `user_roles` schema.
