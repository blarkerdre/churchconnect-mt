## Goal
Let the Children Church worker record **who actually brought the child** (could be the primary parent, another parent, or any authorised adult) at check-in — instead of always defaulting to the searched parent.

## Current state
- `checkin_child` RPC already accepts `_parent_member_id` and stores it in `child_checkins.dropoff_parent_member_id` (NOT NULL). It's already surfaced in reports as "dropoff_parent".
- The UI in `src/pages/ChildrenChurch.jsx` (`CheckInPanel`) hard-codes this to `selectedFamily.parent.id`, so the column always equals the searched family parent — even when a grandparent, other parent, or authorised adult drops the child off.

## Change (frontend only — no DB migration)

### `src/pages/ChildrenChurch.jsx` → `CheckInPanel`
1. After a family is selected, fetch the list of **eligible drop-off adults** for the selected children:
   - the primary guardian of each selected child (from `children.primary_guardian_member_id`)
   - plus every authorised adult linked via `child_guardians` for the selected children
   - join to `members(id, first_name, last_name, phone)` scoped by `.eq("tenant_id", tenantId)`
   - de-duplicate by member id
2. Add a new required field above the Check-in button: **"Brought by"** (`Select` component).
   - Default value: `selectedFamily.parent.id` if present in the list, otherwise first eligible adult.
   - Re-compute the list whenever `selectedChildIds` changes.
   - If no eligible adults are found (shouldn't happen — primary parent is always one), disable check-in with a helper message.
3. Pass the selected member id as `_parent_member_id` to `supabase.rpc("checkin_child", …)` instead of `selectedFamily.parent.id`.
4. Notification logic: still notify the **primary parent** (`selectedFamily.parent`) of the PIN — keep current behaviour. Optionally also notify the "brought by" adult if different and they have a `user_id` (best-effort, silent on failure).
5. Reset the "Brought by" selection in `reset()` and when the family is changed.

## Out of scope
- No schema/RPC changes (column and parameter already exist).
- No changes to pickup flow, PIN, delegation, or reports (report already shows `dropoff_parent`).
- No edit-after-the-fact UI for an already-recorded drop-off adult.
