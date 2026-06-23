# Fix: Children Church workers can't find children in Check-in / Drop-off search

## Root cause

Romoke is a Children Church unit member (not an admin). The Drop-off search in `src/pages/ChildrenChurch.jsx` queries three tables — `children`, `child_guardians`, and `members` — then groups results by parent.

- RLS on `children` and `child_guardians` already allows `is_children_church_member` to read rows.
- RLS on `members` does **not**. The only matches she sees are members of her Home Cell centre (she is a `wsf_leader`), which is why "Domi" returned a couple of names but most searches return "No matching child or parent found."

Because the family grouping is keyed off `members` rows (`allParents`), any child whose parent she can't see is dropped from the result — even when the child row itself was matched.

## Fix

Add a SELECT policy on `public.members` that lets Children Church members view member rows that are linked to any child as a primary guardian or authorised guardian. This is the minimum disclosure needed for drop-off/pickup to function — they only see parents/guardians of registered children, not the whole directory.

### Migration

New policy on `members`:

```text
Children church workers can view guardian members
  USING:
    is_children_church_member(auth.uid(), tenant_id)
    AND (
      EXISTS (SELECT 1 FROM children c
              WHERE c.tenant_id = members.tenant_id
                AND c.primary_guardian_member_id = members.id)
      OR EXISTS (SELECT 1 FROM child_guardians g
                 WHERE g.tenant_id = members.tenant_id
                   AND g.member_id = members.id)
    )
```

No client-side code changes required — the existing search query in `ChildrenChurch.jsx` will start returning the full set of matching parents once the policy is in place.

## Out of scope

- No change to admin/leader/reports-officer policies.
- No exposure of non-guardian members to children's workers.
- No change to the search UI or grouping logic.
