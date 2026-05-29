-- 1. Revoke tenant-scoped super_admin row for blarkerdre@yahoo.com
DELETE FROM public.user_roles
WHERE role = 'super_admin'
  AND tenant_id IS NOT NULL;

-- 2. Enforce: super_admin must always be global (tenant_id IS NULL)
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_super_admin_global_only
  CHECK (role <> 'super_admin' OR tenant_id IS NULL);

-- One global super_admin row per user
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_super_admin_unique
  ON public.user_roles (user_id)
  WHERE role = 'super_admin';

-- 3. Safety trigger: coerce tenant_id to NULL when role is super_admin
CREATE OR REPLACE FUNCTION public.enforce_super_admin_global()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'super_admin' AND NEW.tenant_id IS NOT NULL THEN
    NEW.tenant_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_super_admin_global ON public.user_roles;
CREATE TRIGGER trg_enforce_super_admin_global
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_super_admin_global();