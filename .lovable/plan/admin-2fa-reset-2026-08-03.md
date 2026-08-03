# Admin 2FA reset

Give admins a way to clear a user's authenticator when the user loses their device, so they can sign in again and re-enrol.

## What the admin sees

In User Management, each user row gets a "Reset 2FA" action (in the row's actions menu), shown only when that user actually has an authenticator set up. Choosing it:

- Opens the standard delete-style confirmation that requires the admin to re-enter their own password (high-impact wording: "This user will be able to sign in with just their password until they set up 2FA again").
- On success, shows a toast and the row's 2FA badge disappears.

Users with 2FA enabled also get a small "2FA" badge in the list, so admins can see at a glance who is protected.

## Rules

- Only tenant admins/owners and Super Admins can do it; a tenant admin can only reset users who belong to their tenant.
- Only a Super Admin can reset 2FA for another Super Admin.
- Admins cannot reset their own 2FA from here (they use My Profile → Security).
- Every reset is written to the audit log with the target user and timestamp, so it shows in System Logs.

## Technical notes

- New edge function `admin-reset-mfa`, modelled directly on `admin-toggle-user`: validates the caller's JWT, checks `is_admin` / `has_role('super_admin')`, checks `user_belongs_to_tenant` for the tenant-scoped path, blocks self-reset and non-super-admin resetting a super-admin, then uses the service-role client to list the target's factors (`auth.admin.mfa.listFactors`) and delete each one (`auth.admin.mfa.deleteFactor`). Returns the number removed.
- A companion read path is needed for the badge: the client cannot read `auth.mfa_factors`. Add a `SECURITY DEFINER` function `public.users_with_mfa(_tenant_id uuid)` returning the user_ids that have a verified factor, callable only by admins of that tenant (or super admins). User Management queries it once and maps to rows.
- `src/pages/UserManagement.jsx`: add the badge column data, the menu item, `useConfirmDelete()` for password re-entry, the `supabase.functions.invoke("admin-reset-mfa", ...)` mutation with `tenant_id`, `logAudit("mfa_reset", "profiles", userId, ...)`, and query invalidation.
- `src/pages/SystemLogs.jsx`: add a plain-English label for the `mfa_reset` action.
- After a reset, the target user's next sign-in skips the challenge gate (`useAuth` already derives `mfaRequired` from the live AAL check), and My Profile → Security shows 2FA as off so they can re-enrol.
