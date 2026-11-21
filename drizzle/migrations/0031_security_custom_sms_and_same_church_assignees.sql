-- 1) Custom text-message provider: only platform super-admins may set it (same rule as the call provider)
CREATE OR REPLACE FUNCTION public.guard_custom_voice_provider_config()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.key IN ('custom_voice_provider_config', 'custom_sms_provider_config')
     OR (TG_OP = 'UPDATE' AND OLD.key IN ('custom_voice_provider_config', 'custom_sms_provider_config')) THEN
    -- Backend jobs (no signed-in user) are allowed; signed-in users must be super-admins.
    IF auth.uid() IS NOT NULL THEN
      IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
        IF NEW.key = 'custom_sms_provider_config' OR OLD.key = 'custom_sms_provider_config' THEN
          RAISE EXCEPTION 'Only a platform super-admin can set up a custom text-message provider';
        END IF;
        RAISE EXCEPTION 'Only a platform super-admin can set up a custom call provider';
      END IF;
      NEW.updated_by := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Shared check: is this sign-in account part of this church?
CREATE OR REPLACE FUNCTION public.person_in_tenant(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.tenant_memberships WHERE user_id = _user_id AND tenant_id = _tenant_id)
      OR EXISTS (SELECT 1 FROM public.members WHERE user_id = _user_id AND tenant_id = _tenant_id)
$function$;
REVOKE ALL ON FUNCTION public.person_in_tenant(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.person_in_tenant(uuid, uuid) TO authenticated, service_role;

-- 2) Follow-ups and pastoral care: the assignee must belong to the same church
CREATE OR REPLACE FUNCTION public.enforce_assignee_same_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.assigned_to IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id)
     AND NOT public.person_in_tenant(NEW.assigned_to, NEW.tenant_id) THEN
    RAISE EXCEPTION 'This can only be assigned to someone in this church';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_followups_assignee_same_tenant ON public.followups;
CREATE TRIGGER trg_followups_assignee_same_tenant
  BEFORE INSERT OR UPDATE ON public.followups
  FOR EACH ROW EXECUTE FUNCTION public.enforce_assignee_same_tenant();

DROP TRIGGER IF EXISTS trg_pastoral_care_assignee_same_tenant ON public.pastoral_care;
CREATE TRIGGER trg_pastoral_care_assignee_same_tenant
  BEFORE INSERT OR UPDATE ON public.pastoral_care
  FOR EACH ROW EXECUTE FUNCTION public.enforce_assignee_same_tenant();

-- 3) Unit leader assignments: the leader must belong to the same church
CREATE OR REPLACE FUNCTION public.enforce_unit_leader_same_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.user_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id)
     AND NOT public.person_in_tenant(NEW.user_id, NEW.tenant_id) THEN
    RAISE EXCEPTION 'Unit leaders must be people in this church';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_unit_leader_same_tenant ON public.unit_leader_assignments;
CREATE TRIGGER trg_unit_leader_same_tenant
  BEFORE INSERT OR UPDATE ON public.unit_leader_assignments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_unit_leader_same_tenant();

-- 4) Home Cell centres: the leader (a member record) must belong to the same church
CREATE OR REPLACE FUNCTION public.enforce_wsf_leader_same_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.leader_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.leader_id IS DISTINCT FROM OLD.leader_id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id)
     AND NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id = NEW.leader_id AND m.tenant_id = NEW.tenant_id) THEN
    RAISE EXCEPTION 'Home Cell leaders must be members of this church';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_wsf_leader_same_tenant ON public.wsf_centres;
CREATE TRIGGER trg_wsf_leader_same_tenant
  BEFORE INSERT OR UPDATE ON public.wsf_centres
  FOR EACH ROW EXECUTE FUNCTION public.enforce_wsf_leader_same_tenant();