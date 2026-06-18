Currently, **no** — a child can only have one "primary guardian" in the system. The parent who first registers the child becomes the `primary_guardian_member_id`; that is the only parent who sees the child in **My Family**.

The second parent *can* be added via **Authorised pickup adults** with relationship "Parent", but that only grants pickup authorization in Children Church — they do **not** see the child in their My Family page and cannot edit the child's profile.

This can be fixed with a small frontend change (no database migration needed, since `child_guardians` already exists).

### Plan: Dual-parent visibility in My Family

#### What to change

1. **Broaden the "My Children" query in `MyFamily.jsx`**
   - Currently fetches only where `primary_guardian_member_id = meMember.id`
   - Also fetch children where the current user is linked in `child_guardians` with `relationship = 'Parent'`
   - Merge both result sets so co-parents see the same children list

2. **Preserve the original primary guardian on edit**
   - In `ChildForm`, the save currently sets `primary_guardian_member_id: memberId`
   - When a co-parent edits, this must **not** overwrite the original `primary_guardian_member_id`
   - Only set `primary_guardian_member_id` when creating a brand-new child

3. **Guardian add/remove stays the same**
   - The existing **Authorised pickup adults** dialog already works for adding the second parent
   - No changes needed there

### Technical details

- File: `src/pages/MyFamily.jsx`
- Query change: use a two-step fetch (primary guardian children + guardian-Parent children) or a server-side join via `child_guardians`
- No database schema changes, no RLS changes, no new tables

### Result

Both parents see the child in **My Family**, can edit the child's details, and can generate pickup delegation codes. The original registering parent remains the `primary_guardian_member_id` for admin/leader reference.