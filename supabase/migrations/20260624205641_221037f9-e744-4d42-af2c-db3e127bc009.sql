CREATE OR REPLACE FUNCTION public.cleanup_unit_leader_assignments_on_role_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role = 'unit_leader' THEN
    DELETE FROM public.unit_leader_assignments
    WHERE user_id = OLD.user_id
      AND tenant_id = OLD.tenant_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_unit_leader_assignments ON public.user_roles;

CREATE TRIGGER trg_cleanup_unit_leader_assignments
AFTER DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_unit_leader_assignments_on_role_delete();