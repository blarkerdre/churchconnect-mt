

## Fix: Auto-Activate Tenants + Fix WCI Cardiff

### What
1. **Fix WCI Cardiff now** — set `setup_complete = true` for the `wci-cardiff` tenant
2. **Add automatic trigger** — when a tenant gets its first member, automatically set `setup_complete = true`

### How
One database migration with two parts:

```sql
-- 1. Fix WCI Cardiff immediately
UPDATE public.tenants
SET setup_complete = true, updated_at = now()
WHERE slug = 'wci-cardiff' AND setup_complete IS NOT TRUE;

-- 2. Create trigger to auto-activate on first member
CREATE OR REPLACE FUNCTION public.auto_activate_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN
    UPDATE public.tenants
    SET setup_complete = true, updated_at = now()
    WHERE id = NEW.tenant_id
      AND setup_complete IS NOT TRUE;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_activate_tenant
AFTER INSERT ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.auto_activate_tenant();
```

### Files changed
- 1 database migration (no code changes)

