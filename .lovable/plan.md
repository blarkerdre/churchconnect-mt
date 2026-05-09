## Why the dropdown is empty

In `src/components/followups/FollowupFormDialog.jsx` the "Assigned To" list is built like this:

```js
const assignees = members
  .filter((m) => (m.church_units || []).includes("Follow-up"))
  ...
```

It is reading **`church_units`** (plural, array) — but the `members` table actually stores the unit in **`church_unit`** (singular, text). The page (`src/pages/Followups.jsx` line 125) selects `church_unit`, so `m.church_units` is always `undefined`, the filter returns nothing, and the dropdown is empty — falling back to the manual text input only.

WCI Cardiff has 6 members with `church_unit` containing "Follow-up" who should appear in the list, so the data is fine — only the field name is wrong.

(The separate "Reassign" flow inside `FollowupDetailPanel` already queries correctly via `followupUnitMembers` in `Followups.jsx`, so it is not affected by this bug. If that one also looks empty for you, we'll investigate it separately.)

## Fix

Single-file change in `src/components/followups/FollowupFormDialog.jsx`:

1. Change the assignees filter to match the real column and accept any case / "follow up" / "follow-up" variant:
   ```js
   const assignees = members
     .filter((m) => (m.church_unit || "").toLowerCase().includes("follow"))
     .map((m) => ({ id: m.id, name: `${m.first_name} ${m.last_name}` }));
   ```
2. No schema, RLS, or other component changes needed.

## Verification

- Open Follow-ups → Create / Edit follow-up → "Assigned To" dropdown should now list the 6 WCI Cardiff Follow-up unit members.
- Manual-name input still works as a fallback when no members match.
