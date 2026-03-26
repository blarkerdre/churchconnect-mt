

## Fix: `user_has_tenant_access` Returns TRUE for NULL tenant_id

### Problem

The current function:
```sql
SELECT _tenant_id IS NULL OR EXISTS (...)
```
Returns `TRUE` when `_tenant_id IS NULL`, making any record without a `tenant_id` accessible to **all** authenticated users across all tenants. This affects every table using this function for RLS (members, announcements, events, followups, pastoral_care, messages, documents, notifications, etc.).

### Current State

Query confirms **zero rows** have NULL `tenant_id` across all major tables, so changing the function will not break access to existing data.

### Fix

One database migration to replace the function:

```sql
CREATE OR REPLACE FUNCTION public.user_has_tenant_access(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _tenant_id IS NULL THEN FALSE
    ELSE EXISTS (
      SELECT 1 FROM public.tenant_memberships
      WHERE user_id = auth.uid() AND tenant_id = _tenant_id
    )
  END
$$;
```

### Impact

- All RLS policies using `user_has_tenant_access(tenant_id)` automatically benefit
- Records without `tenant_id` become inaccessible (correct behavior -- no orphan data exists)
- No application code changes needed

### Files Changed

- One database migration only

