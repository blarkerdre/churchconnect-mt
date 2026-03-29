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