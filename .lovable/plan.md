## Goal

You're right — there is no platform-wide users list in Tenant Admin today. The existing `TenantUsersDialog` is per-tenant only, and `UserManagement.jsx` is scoped to the current tenant. So there is currently no UI to promote someone to (or demote them from) global Super Admin. The only way right now is direct DB insert into `user_roles` with `role='super_admin'` and `tenant_id=NULL`.

This plan adds that missing UI.

## 1. New "Platform Users" tab in Tenant Admin

In `src/pages/TenantAdmin.jsx`, add a fourth top-level tab next to **Tenants / Analytics / Integrations**:

- `TabsTrigger value="platform-users"` labelled **Platform Users** (icon: `Users2`).
- `TabsContent` renders a new component `PlatformUsersTab`.

Gated by `SuperAdminRoute` (already wraps the page), so only existing super admins see it.

## 2. New component: `src/components/tenants/PlatformUsersTab.jsx`

A searchable table of every user on the platform.

**Columns:** Avatar + Name, Email, Tenant memberships (chips: tenant name + role), Super Admin badge, Last sign-in, Actions.

**Data source:**
- `profiles` (id, user_id, full_name, email, avatar_url) — primary list.
- `user_roles` filtered to `role='super_admin'` (and `tenant_id IS NULL`) — to flag who's a super admin.
- `tenant_memberships` joined to `tenants(name, slug)` — to show which churches they belong to.
- Last sign-in from `auth.users.last_sign_in_at` via the existing `admin-list-banned-users` pattern or a small new edge function (see Technical notes).

**Search / filters:** text search on name + email; filter chips for "Super admins only" and "No tenant memberships".

**Actions per row (super admin only):**
- **Promote to Super Admin** — visible when user is not already a super admin.
- **Revoke Super Admin** — visible when they are. Disabled for the currently signed-in user (cannot demote yourself; prevents lockout).
- Both actions open a small confirm dialog stating the consequence ("This grants/removes platform-wide access to every tenant").

## 3. Promotion / revocation logic

Both actions write directly via the Supabase client (the existing CHECK constraint + unique index + trigger from the previous migration already enforce correctness):

```js
// Promote
await supabase.from("user_roles").insert({
  user_id, role: "super_admin", tenant_id: null,
});

// Revoke
await supabase.from("user_roles").delete()
  .eq("user_id", user_id).eq("role", "super_admin").is("tenant_id", null);
```

Each action calls `logAudit("super_admin_grant" | "super_admin_revoke", "user_roles", user_id, { target_email })` (no tenant_id — these are global actions).

RLS check: confirm `user_roles` policies allow super admins to INSERT/DELETE rows for other users. If not, the actions go through a tiny new edge function `admin-set-super-admin` (service role) that verifies the caller is a super admin via `has_role` before mutating. I'll check the existing RLS during implementation and pick whichever path is needed — preference is direct client write to keep it simple.

## 4. UI hardening recap (already done)

- `super_admin` is no longer in the per-tenant role picker (`UserManagement.jsx`).
- DB rejects `super_admin` rows with a non-null `tenant_id`.

So the new Platform Users tab is the **only** place super admin can be granted, which matches the security model.

## Technical notes

- For last-sign-in, easiest path is to add a small read-only edge function (`admin-list-platform-users`) that uses the service role to call `auth.admin.listUsers()` and joins to profiles. If we want to skip the edge function entirely in v1, omit the "Last sign-in" column and just query `profiles` + `user_roles` + `tenant_memberships` directly.
- Tab content should paginate (50/page) — there could eventually be thousands of users across tenants.
- No schema changes needed.
- File list:
  - new: `src/components/tenants/PlatformUsersTab.jsx`
  - edited: `src/pages/TenantAdmin.jsx` (add tab + import)
  - optional new: `supabase/functions/admin-list-platform-users/index.ts` (only if we want last-sign-in)

## Out of scope

- Editing profiles, banning/unbanning users (already handled elsewhere), or changing per-tenant membership roles (that stays in `TenantUsersDialog`).
- Inviting brand-new users — keep using existing `invite-to-tenant` flow.
