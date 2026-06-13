## Root cause

`register_walkin_family` creates the parent `members` row and the `children` rows (with `primary_guardian_member_id`) but **never inserts a `child_guardians` row** linking the parent to each child. At pickup time:

- The Release panel reads from `child_guardians` → "⚠ No authorised adults registered." appears, and the "Who is collecting?" select is empty.
- The `release_child` RPC's PIN path requires the chosen adult to exist in `child_guardians` with `can_pickup = true` → it rejects with "Adult is not on the authorised pickup list".

Net effect: walk-in family children can only be released via leader override, even though a parent member record exists.

## Fix

1. **Migration — patch `register_walkin_family`**: after each child INSERT, also insert a `child_guardians` row for the walk-in parent:
   - `tenant_id = _tenant_id`, `child_id = v_child_id`, `member_id = v_member_id`
   - `relationship = 'Parent'`, `can_pickup = true`, `is_primary = true`

2. **Backfill** existing walk-in families: insert missing `child_guardians` rows for every child whose `primary_guardian_member_id` is set but has no matching `child_guardians` entry (scoped to members with `source = 'children_church_walkin'` to be conservative).

3. **Verification**:
   - Register a new walk-in family → pickup tab shows the parent under "Authorised adults" and in the collector dropdown.
   - Existing walk-in checked-in children now show their parent as authorised; PIN + parent release succeeds.

## Out of scope

- No UI changes to `PickupPanel` or `WalkInRegisterDialog`.
- No changes to `release_child` logic, RLS, or other pickup methods.
