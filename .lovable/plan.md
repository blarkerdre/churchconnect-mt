# Let church admins invite users themselves

Today the invite form only exists inside Tenant Admin, which is restricted to super admins. The backend already allows a church owner or admin to invite people into their own church — only the screen is missing. This adds that screen.

## What changes

**New "Invitations" section on User Management** (`/user-management`, already admin-only and tenant-scoped):

- An invite form: email address, role dropdown, "Send invite" button.
- Role options follow the existing rules — Member is always available; Admin and Owner appear only if the signed-in user is an owner of this church or a super admin.
- A list of pending invitations for the current church showing email, role, who invited them, and when it expires, with a "Resend" and a "Cancel" action per row.
- Cancelling uses the standard password-confirmation flow used everywhere else for destructive actions.
- Empty state when there are no pending invites.

**Behaviour reused as-is** (no backend changes):

- Sending calls the existing `invite-to-tenant` function, which re-checks that the caller is an admin of that church and blocks Admin/Owner assignment unless the caller is an owner or super admin. A church admin cannot invite into a church they don't administer, even by tampering.
- If the invited email is already a member of this church, their role is updated instead of creating a duplicate invite.
- Re-inviting the same address reuses and resends the existing pending invite.
- The invited person gains access when they sign in with that email; the invitation is consumed automatically at that point.

**Tenant Admin stays unchanged** — super admins keep the existing dialog for managing any church.

## Technical notes

- Reuse the invite form, mutation and pending-invite table already implemented in `src/components/tenants/TenantUsersDialog.jsx` by extracting them into a shared component (e.g. `src/components/tenants/TenantInvitePanel.jsx`) that takes a `tenantId`. Tenant Admin renders it with the selected church; User Management renders it with the active tenant from `useTenantQuery()`.
- All invitation reads/writes carry an explicit `.eq("tenant_id", tenantId)` guard, matching the project rule.
- Owner/admin role visibility comes from `useAuth()` (`tenantMemberships` role for the active tenant, plus `super_admin`), mirroring the `canPromoteToAdmin` logic already in the dialog.
- No database migration and no edge function changes — existing RLS policies on `tenant_invitations` and the 403 guards in `invite-to-tenant` already cover this path.
