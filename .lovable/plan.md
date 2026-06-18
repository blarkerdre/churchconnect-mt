## Problem

Adding an authorised adult fails for non-admin parents because the `child_guardians` INSERT/UPDATE/DELETE policy only allows:

- tenant admins, or
- the child's primary guardian, identified by `children.primary_guardian_member_id` → `members.user_id = auth.uid()`.

Two real-world cases break this:

1. The parent's `members` row has `user_id = NULL` (common — members aren't always linked to an auth account), so the primary-guardian check returns false even for the actual parent.
2. A co-parent (already listed in `child_guardians`) cannot add additional authorised adults at all — only the single "primary" guardian can.

## Fix

Update the `child_guardians` write policy so a parent can manage authorised adults when any of the following is true:

- they are a tenant admin / owner (unchanged)
- they are the child's primary guardian (unchanged: `is_child_primary_guardian`)
- they are already a co-parent on that child (new: reuse `is_child_co_parent`)
- they are a Children Church worker/leader for the tenant (new: reuse `is_children_church_member`) — so leaders can help register adults at drop-off

Also harden `is_child_primary_guardian` so a parent whose `members` row is linked by `auth.users.email` (but not yet by `user_id`) still resolves: fall back to matching `members.email = (select email from auth.users where id = _user_id)` within the same tenant. This recovers parents whose member record predates their auth account link.

No application code changes — the existing `MyFamily.jsx` "Add authorised adult" UI keeps working once the policy allows the insert.

## Technical details

- Migration: drop and recreate the `Child guardians manage` policy on `public.child_guardians` with the expanded `USING`/`WITH CHECK` predicate listed above.
- Migration: `CREATE OR REPLACE FUNCTION public.is_child_primary_guardian` to add the email-based fallback (still `SECURITY DEFINER`, `STABLE`, `search_path = public`).
- No grant changes needed; existing grants on `child_guardians` remain.
- No schema changes, no frontend changes.

## Validation

After the migration:

1. As a parent user who is the primary guardian (member linked or only by email), open My Family → Authorised adults → add a member. Insert should succeed.
2. As a co-parent already on a child, repeat — insert should succeed.
3. As an unrelated regular member, repeat — insert should still be rejected by RLS.
4. As a tenant admin and as a Children Church worker, repeat — insert should succeed.
