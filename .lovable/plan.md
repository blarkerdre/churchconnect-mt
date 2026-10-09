# Let church owners give the Admin role

## Why it fails today
Odunsi Temitayo Ezekiel is the **Owner** of WCI Cardiff (and holds Admin there). The Users page offers "Admin" in the role picker, but the database rule for role changes only lets church admins/owners assign Member, Unit Leader, Home Cell Leader and Reports Officer. "Admin" is reserved for super admins, so his save is refused silently/with an error.

This conflicts with the rest of the app (invites and account creation already let an Owner assign Admin).

## Fix
- Database: add a rule letting a **church Owner** add or remove the Admin role for people in **their own church only**. Ordinary church admins still cannot create other admins; super admin stays platform-only.
- Users page: show "Admin" in the role picker only to Owners and super admins, so non-owner admins don't see an option that will fail.
- Show a clear message if a role change is refused instead of failing quietly.
- Owners cannot remove their own Admin role by accident (button disabled for self).

## Technical notes
- New SECURITY DEFINER `is_tenant_owner(_user_id, _tenant_id)` (checks `tenant_memberships.role = 'owner'`), search_path = public.
- New `user_roles` ALL policy: `is_tenant_owner(auth.uid(), tenant_id) AND tenant_id IS NOT NULL AND role = 'admin'` (using + with check). Existing MFA restrictive policy still applies.
- `UserManagement.jsx`: filter `ROLES` by `isSuperAdmin || tenant membership role === 'owner'`; surface insert/delete errors in a toast.
- Test: owner can grant admin in own tenant; non-owner admin cannot; owner cannot grant admin in another tenant.
