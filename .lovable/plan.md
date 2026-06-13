## What I found

- Dominion Olusegun exists and is active.
- Dominion is not currently checked in, so the new duplicate check-in guard is not blocking her.
- Dominion is linked to guardian Blarker Dre, but Blarker has no phone number.
- The current check-in UI only searches members by parent name/phone, then loads children where that member is the primary guardian.
- The browser preview is at the sign-in screen, so I could not reproduce the button click in-session.

## Why Dominion check-in is failing

The workflow is too parent-dependent. If the worker searches `Dominion`, the current UI will not find her because it only searches `members.first_name`, `members.last_name`, and `members.phone`. It does not search child names or guardian records.

Also, if the staff member is not signed in as a Children Church worker/admin, the backend will reject check-in with `Only Children Church workers can check in`.

## Plan to fix

1. Update the Check-in search so staff can search by:
   - child first/last name, e.g. `Dominion` or `Olusegun`
   - primary guardian name
   - authorised guardian name
   - guardian/parent phone when available

2. Change the search results from “parents only” to grouped family results:
   - show the guardian/parent name
   - show matching children underneath
   - allow selecting Dominion directly when her name matches

3. Keep the existing secure check-in backend, but make frontend errors clearer:
   - show `Dominion Olusegun is already checked in...` if applicable
   - show `Only Children Church workers can check in` if staff permissions are missing
   - show a visible message if no matching child/guardian is found

4. Preserve tenant isolation:
   - every query will continue to include `tenant_id`
   - no changes to pickup PIN security or guardian pickup rules

## Technical notes

- Modify `src/pages/ChildrenChurch.jsx` only unless a backend permission issue is discovered during implementation.
- Use existing `children.primary_guardian_member_id` and `child_guardians.member_id` relationships.
- Keep the current `checkin_child` RPC for check-in execution.