CREATE OR REPLACE FUNCTION public.enforce_unit_task_assignment_same_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.member_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.members m WHERE m.id = NEW.member_id AND m.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'Tasks can only be assigned to members of this church';
  END IF;
  IF NEW.user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships tm WHERE tm.user_id = NEW.user_id AND tm.tenant_id = NEW.tenant_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.members m WHERE m.user_id = NEW.user_id AND m.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'Tasks can only be assigned to people in this church';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_uta_same_tenant ON public.unit_task_assignments;
CREATE TRIGGER trg_uta_same_tenant
BEFORE INSERT OR UPDATE OF member_id, user_id, tenant_id ON public.unit_task_assignments
FOR EACH ROW EXECUTE FUNCTION public.enforce_unit_task_assignment_same_tenant();

CREATE OR REPLACE FUNCTION public.guard_custom_voice_provider_config()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.key = 'custom_voice_provider_config'
     OR (TG_OP = 'UPDATE' AND OLD.key = 'custom_voice_provider_config') THEN
    -- Backend jobs (no signed-in user) are allowed; signed-in users must be super-admins.
    IF auth.uid() IS NOT NULL THEN
      IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
        RAISE EXCEPTION 'Only a platform super-admin can set up a custom call provider';
      END IF;
      NEW.updated_by := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_custom_voice_provider_config ON public.app_settings;
CREATE TRIGGER trg_guard_custom_voice_provider_config
BEFORE INSERT OR UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.guard_custom_voice_provider_config();