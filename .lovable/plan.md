## Goal
Let admins manage the Children's Church **Age Groups** list instead of being stuck with the hardcoded four (`Nursery`, `Toddler`, `Primary`, `Pre-Teen`).

## Approach
Mirror the pattern already used for `event_categories` (stored in `app_settings`, read via `useAppSetting`).

### 1. Settings UI
In `src/pages/Settings.jsx` (Children's Church / Configuration section — wherever children-related toggles live; otherwise add a small card alongside `WSFCentresSection`-style components):
- New small section "Children's Church Age Groups".
- List current groups as chips with delete (×).
- Input + "Add" button to append a new group.
- Save persists to `app_settings` key `children_age_groups` (default `["Nursery","Toddler","Primary","Pre-Teen"]`) using the existing `useAppSetting` write helper / supabase upsert pattern.
- Only visible to tenant admins/owners (same gating as other settings sections).

### 2. Consume the setting
Replace the hardcoded `AGE_GROUPS` constant in:
- `src/pages/ChildrenChurch.jsx` (line 122)
- `src/pages/MyFamily.jsx` (line 20)

with:
```js
const { data: AGE_GROUPS = [] } = useAppSetting("children_age_groups", ["Nursery","Toddler","Primary","Pre-Teen"]);
```
All existing `<Select>` usages keep working since they just map over the array.

### 3. Backward compatibility
- Existing children rows keep their stored `age_group` string even if an admin removes that label later (we don't rewrite data).
- Default fallback ensures tenants without the setting still see the original four.

## Out of scope
- No DB schema change (uses existing `app_settings` table).
- No change to how `age_group` is stored on the `children` table.
- No bulk-rename of historical values.