# Training Report: Training Reps can't find members to add

## What's happening

Joseph Oyebanji is in the Training Rep unit, so the "Add members" button appears and he can open the picker — but the list is empty and searching finds nobody. Anyone in the same position (a Training Rep who isn't also a church admin or a unit leader) sees the same thing.

The cause is the directory's privacy rules, not the training screen. An ordinary member may only read their own record from the member directory. Being in the Training Rep unit doesn't grant directory access, so the picker has nothing to show. The rules that let Training Reps add, edit and view attendees are all in place — only the lookup is blocked.

## The fix

Give the attendee picker its own narrow lookup that returns just what it needs — name and email — instead of opening the whole member directory.

1. Add a secure lookup that returns member id, first name, last name and email for the current church, available only to church admins and members of the Training Rep unit.
2. Point the "Add members" picker at that lookup instead of reading the member directory directly. Everything else on the screen stays the same.
3. Leave all other directory privacy rules untouched — Training Reps still can't see phone numbers, addresses, dates of birth or any other personal detail, and can't edit member records.

## Verification

- Signed in as Joseph, open a training report, click "Add members": the list fills, search by name and email works, and selected people save as attendees.
- Signed in as an ordinary member with no Training Rep involvement: the lookup returns nothing and the button stays hidden.

## Technical details

- `TrainingAttendeesPanel.jsx` queries `members` directly (`select id, first_name, last_name, email`). No SELECT policy on `members` matches a plain `member` role whose `church_unit` includes "Training Rep", so the result is empty.
- Add SECURITY DEFINER function `get_training_attendee_candidates(_tenant_id uuid)` with `SET search_path = public`, guarded by `user_has_tenant_access(_tenant_id) AND (is_admin(auth.uid(), _tenant_id) OR is_training_rep_member(auth.uid(), _tenant_id) OR is_training_rep_leader(auth.uid(), _tenant_id))`, returning only `id, first_name, last_name, email` ordered by first name. `GRANT EXECUTE ... TO authenticated`.
- Swap the picker's `members` query for `supabase.rpc("get_training_attendee_candidates", { _tenant_id: tenantId })`; keep client-side search and the existing insert path unchanged.
