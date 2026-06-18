## Problem

Adding a child fails with:
`new row for relation "children" violates check constraint "children_age_group_check"`

## Root cause

The `children` table has a hardcoded DB CHECK constraint that only accepts four age-group values:

```
Nursery, Toddler, Primary, Pre-Teen
```

But age groups are admin-configurable through the `children_age_groups` app setting (Settings → Children's Church). As soon as a tenant adds or renames a group (e.g. "Juniors", "Crèche", "Youth"), saving a child with that label is rejected by the constraint — even though the UI offered the value.

## Fix

Drop the rigid CHECK constraint so the configurable setting is the single source of truth for allowed values. The UI already restricts entries to values from `children_age_groups`, and `age_group` remains nullable (DOB can be used instead).

### Migration

```sql
ALTER TABLE public.children
  DROP CONSTRAINT IF EXISTS children_age_group_check;
```

No code, RLS, or UI changes are needed. The `children_gender_check` constraint is kept as-is (gender is not configurable).

## Verification

After the migration, adding a child with a custom age group label (e.g. the value that previously failed) saves successfully, and the existing four defaults continue to work.