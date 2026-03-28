

## Fix: "Database error saving user" on Signup

### Root Cause

The `handle_new_user()` trigger function declares `_inv_role` as `text`, then inserts `COALESCE(_inv_role, 'member')` into `tenant_memberships.role`, which is a `tenant_role` enum column. Postgres rejects the implicit `text → tenant_role` cast, causing a 500 error on every signup where a tenant is resolved.

### Fix

One database migration to replace the function, casting the value explicitly:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id uuid;
  _inv_id uuid;
  _inv_role text;
  _slug text;
BEGIN
  -- (existing invitation + slug resolution — unchanged)
  ...

  -- Create profile (unchanged)
  ...

  IF _tenant_id IS NOT NULL THEN
    INSERT INTO public.tenant_memberships (user_id, tenant_id, role)
    VALUES (NEW.id, _tenant_id, COALESCE(_inv_role, 'member')::tenant_role)   -- ← cast added
    ON CONFLICT (user_id, tenant_id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role, tenant_id)
    VALUES (NEW.id, 'member', _tenant_id)
    ON CONFLICT (user_id, role, tenant_id) DO NOTHING;

    IF _inv_id IS NOT NULL THEN
      UPDATE public.tenant_invitations
      SET status = 'accepted'
      WHERE id = _inv_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
```

The only change is adding `::tenant_role` to the `COALESCE(_inv_role, 'member')` expression on the `tenant_memberships` insert.

### Files changed
- 1 database migration (no code file changes)

