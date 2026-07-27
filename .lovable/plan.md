## Goal
Three MyFamily / Teens tweaks:
1. Confirm parents receive in-app notifications when a teen checks in / out.
2. Require at least one authorised adult when registering a child.
3. In the authorised-adults picker, hide the relationship dropdown until an adult is selected.

## 1. Teen check-in/out in-app notification (verify only)

`public.teen_checkin` and `public.teen_self_checkin` already `INSERT` into `public.notifications` for the primary guardian and every `child_guardians` row of the teen (type `teen_checkin`, `reference_type = teen_attendance`). `NotificationBell` renders `teen_checkin` with a Users icon and label "Teens Attendance", and `send-push` maps that type to `/teens-attendance`.

No code change needed — flag this in the reply so the user knows it is already live. If the user reports not seeing them, next step will be to check whether the parent has a linked `members.user_id` in that tenant (only linked members are notified).

## 2. Authorised adult compulsory during child registration

Edit `src/pages/MyFamily.jsx` → `ChildForm`:

- Add "Authorised pickup adult" section, shown only when creating a new child (`!child?.id`), placed just above the consent block.
- Reuse `search_tenant_members_for_guardian` to search by name, tap a result to add. Show chips of selected adults with a small trash button. Each chip stores `{ member_id, first_name, last_name, relationship }`.
- After the first adult is added the relationship dropdown appears next to that chip (same behaviour as #3).
- Validation: `save.mutateAsync` throws "Add at least one authorised pickup adult" when the list is empty on a new child.
- Save flow:
  1. Insert child (as today, capturing `data.id` from `.select().single()`).
  2. Insert one row per selected adult into `child_guardians` with `{ child_id, member_id, relationship, can_pickup: true }` via `withTenant`.
  3. Invalidate the `children` and `child-guardians` queries.
- Edit mode is unchanged — existing children continue to manage adults through the current `GuardianManager` dialog (which now also applies rule #3).

## 3. Relationship dropdown appears only after an adult is picked

Edit `GuardianManager` in `src/pages/MyFamily.jsx`, and mirror the same pattern in the new inline picker from step 2:

- Replace the current "Search + Relationship" two-column row with a single search input.
- Tapping a search result no longer inserts immediately. It sets `pendingAdult = { id, first_name, last_name }` and clears the search list.
- When `pendingAdult` is set, render a small confirmation row: name of the picked adult, a Relationship `<Select>` (default "Family", same options as today), a "Confirm" button, and a "Cancel" (clears `pendingAdult`).
- Confirm calls the existing `addGuardian.mutate(pendingAdult.id)` with the chosen relationship, then clears `pendingAdult` and `relationship`.

## Files
- `src/pages/MyFamily.jsx` — `ChildForm` (new authorised-adult picker, validation, guardian insert after child insert) and `GuardianManager` (gated relationship dropdown).

## Out of scope
- No database changes. `child_guardians` already supports the insert. RLS already lets a parent add guardians to their own child.
- No changes to teen check-in code.
