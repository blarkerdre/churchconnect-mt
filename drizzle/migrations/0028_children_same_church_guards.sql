CREATE OR REPLACE FUNCTION public.enforce_child_link_same_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _child_tenant uuid;
  _member_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'children' THEN
    _member_id := NEW.primary_guardian_member_id;
    IF _member_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.members m WHERE m.id = _member_id AND m.tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'The parent must be a member of this church' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  SELECT c.tenant_id INTO _child_tenant FROM public.children c WHERE c.id = NEW.child_id;
  IF _child_tenant IS NULL THEN
    RAISE EXCEPTION 'Child not found' USING ERRCODE = '23503';
  END IF;
  IF NEW.tenant_id IS DISTINCT FROM _child_tenant THEN
    RAISE EXCEPTION 'This child belongs to a different church' USING ERRCODE = '42501';
  END IF;

  IF TG_TABLE_NAME = 'child_guardians' THEN
    _member_id := NEW.member_id;
  ELSE
    _member_id := NEW.issued_by_member_id;
  END IF;

  IF _member_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.members m WHERE m.id = _member_id AND m.tenant_id = _child_tenant
  ) THEN
    RAISE EXCEPTION 'Authorised adults must be members of this church' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_child_link_same_tenant() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_child_guardians_same_tenant ON public.child_guardians;
CREATE TRIGGER trg_child_guardians_same_tenant
  BEFORE INSERT OR UPDATE OF child_id, member_id, tenant_id ON public.child_guardians
  FOR EACH ROW EXECUTE FUNCTION public.enforce_child_link_same_tenant();

DROP TRIGGER IF EXISTS trg_child_delegations_same_tenant ON public.child_pickup_delegations;
CREATE TRIGGER trg_child_delegations_same_tenant
  BEFORE INSERT OR UPDATE OF child_id, issued_by_member_id, tenant_id ON public.child_pickup_delegations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_child_link_same_tenant();

DROP TRIGGER IF EXISTS trg_children_guardian_same_tenant ON public.children;
CREATE TRIGGER trg_children_guardian_same_tenant
  BEFORE INSERT OR UPDATE OF primary_guardian_member_id, tenant_id ON public.children
  FOR EACH ROW EXECUTE FUNCTION public.enforce_child_link_same_tenant();