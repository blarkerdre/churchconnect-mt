CREATE OR REPLACE FUNCTION public.children_guard_archive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
    IF NOT (public.is_admin(auth.uid(), OLD.tenant_id)
            OR public.has_role(auth.uid(), 'super_admin'::app_role)
            OR public.is_child_primary_guardian(auth.uid(), OLD.id, OLD.tenant_id)) THEN
      RAISE EXCEPTION 'Only the main parent or a church admin can archive a child' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_children_guard_archive ON public.children;
CREATE TRIGGER trg_children_guard_archive
  BEFORE UPDATE OF archived_at ON public.children
  FOR EACH ROW EXECUTE FUNCTION public.children_guard_archive();