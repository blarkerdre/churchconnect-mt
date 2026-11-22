CREATE OR REPLACE FUNCTION public.revoke_tenant_roles_on_removal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.user_id IS NULL OR OLD.tenant_id IS NULL THEN RETURN OLD; END IF;
  DELETE FROM public.user_roles
   WHERE user_id = OLD.user_id AND tenant_id = OLD.tenant_id AND role <> 'super_admin';
  DELETE FROM public.unit_leader_assignments
   WHERE user_id = OLD.user_id AND tenant_id = OLD.tenant_id;
  RETURN OLD;
END $$;
REVOKE EXECUTE ON FUNCTION public.revoke_tenant_roles_on_removal() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_revoke_roles_on_membership_delete ON public.tenant_memberships;
CREATE TRIGGER trg_revoke_roles_on_membership_delete AFTER DELETE ON public.tenant_memberships
FOR EACH ROW EXECUTE FUNCTION public.revoke_tenant_roles_on_removal();
DROP TRIGGER IF EXISTS trg_revoke_roles_on_member_delete ON public.members;
CREATE TRIGGER trg_revoke_roles_on_member_delete AFTER DELETE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.revoke_tenant_roles_on_removal();