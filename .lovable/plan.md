## Goal

Add a "Promote to teenager" action on each child card in My Family that copies the child into the `teens` table and then removes the child record.

## UX

In `src/pages/MyFamily.jsx`, on each child card (next to Edit / Authorised adults / Delegate pickup / Delete) add a new button **"Promote to teenager"**. It opens a small confirmation dialog explaining:

- A matching teenager record will be created (parental consent carried over, PIN optional — can be set later in the Teenagers section).
- The child record will then be removed.
- If the child has Children Church check-in history, the child record will be kept but marked inactive so it stops showing under My Family, preserving report history. (Same rule the current delete uses.)

Confirm button runs the mutation below; on success, refetch both `my-children` and `my-teens` queries and toast "Promoted to teenager".

## Mutation flow

1. Insert into `public.teens` scoped to current `tenant_id` and `memberId = meMember.id`, copying:
   - `first_name`, `last_name`, `date_of_birth`, `gender`, `notes`
   - `attendance_consent = child.parental_consent_given`
   - `attendance_consent_at = child.parental_consent_at ?? now()`
2. Check `child_checkins` count for this child (same guard the current delete uses).
   - If 0 → `delete from children where id = ...` (existing path).
   - If > 0 → `update children set archived_at = now() where id = ...` so it disappears from My Family without breaking historical reports.
3. Invalidate `["my-children"]` and `["my-teens"]` query keys.

## Schema change (small)

Add `archived_at timestamptz null` to `public.children` and filter it out in the two My Family child queries (`primary` and the "all tenant" branch) with `.is("archived_at", null)`. Leave admin/reports pages unchanged so archived children still appear in historical Children Church reports.

No RLS changes needed — updates and deletes already run under the existing "guardian can manage own child" policies.

## Files touched

- `supabase/migrations/*` — add `children.archived_at` column.
- `src/pages/MyFamily.jsx` — add promote button, confirm dialog, mutation, and `archived_at` filter on the child queries.

No changes to the Teens section, RLS policies, or Children Church pages.
