## Goal
Fix the `blarkerdre@yahoo.com` super_admin issue and prevent it from happening again.

## 1. Data fix — revoke the bad row

Delete the tenant-scoped `super_admin` row for `blarkerdre@yahoo.com` from `user_roles` (the one with `tenant_id = d8bbbdae…` / WCI Cardiff). His `tenant_memberships` row stays intact, so he keeps normal access to WCI Cardiff but loses fake super-admin status. Audit-log the revoke.

## 2. DB hardening — make the invalid state impossible

Migration on `public.user_roles`:

- Add a `CHECK` constraint: `role <> 'super_admin' OR tenant_id IS NULL`.
- Add a partial unique index so a given user has at most one global super_admin row: `UNIQUE (user_id) WHERE role = 'super_admin'`.
- (Optional safety) `BEFORE INSERT/UPDATE` trigger that nulls `tenant_id` when `role = 'super_admin'`, so legacy code paths that pass `tenant_id` don't error — they just get coerced to the correct global row.

This guarantees `has_role(uid, 'super_admin')` (which already requires `tenant_id IS NULL`) can never disagree with what's in the table again.

## 3. UI hardening — hide super_admin from the tenant role picker

`src/pages/UserManagement.jsx`:

- Remove `"super_admin"` from the `ROLES` array used by the per-tenant role picker. Keep `roleIcons`/`roleColors`/`roleLabels` entries so existing super_admin badges still render correctly in the list, but the role can no longer be **assigned** from this screen — even by an existing super_admin. Promotion to platform super_admin should only happen via the dedicated super-admin flow (Tenant Admin), never inside a tenant context.
- Remove the now-dead `isSuperAdmin ? ROLES : ROLES.filter(...)` branches (lines ~309–311 and ~452) and just use `ROLES` directly.
- Leave the existing guard that prevents non–super-admins from editing other admins' roles in place.

## Technical notes

- Migration order: run the data delete first (step 1) so the new CHECK constraint doesn't reject existing rows when added. Alternatively, do both in one migration: `DELETE` → `ALTER TABLE ... ADD CONSTRAINT`.
- The trigger from step 2 is belt-and-suspenders; the CHECK alone is sufficient if we're confident no other code path inserts `super_admin` with a `tenant_id`. I'll include the trigger for safety.
- No changes needed to `has_role`, RLS policies, or `useAuth` — they already treat super_admin as global-only.

## Out of scope
- No change to `kugbiyiadeniyi@gmail.com` (correct global super_admin).
- No change to `tenant_memberships` for blarkerdre (he remains a normal WCI Cardiff member/whatever role he had there).
