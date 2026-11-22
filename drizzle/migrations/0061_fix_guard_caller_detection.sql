-- Guards that tell "a signed-in person changing this directly" from trusted server code
-- must run with the caller's own rights; inside an owner-rights function the caller is
-- always reported as the owner, so the check never fired.
ALTER FUNCTION public.tenants_guard_call_billing() SECURITY INVOKER;
ALTER FUNCTION public.tenants_guard_subscription() SECURITY INVOKER;

-- Usage lookup: hide other churches' call usage from signed-in people.
CREATE OR REPLACE FUNCTION public.call_minutes_used(_tenant_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (
       public.has_role(auth.uid(), 'super_admin') OR public.user_has_tenant_access(_tenant_id)) THEN
    RETURN 0;
  END IF;
  RETURN COALESCE((SELECT sum(billable_minutes) FROM public.call_log
    WHERE tenant_id = _tenant_id AND created_at >= public.call_cycle_start(_tenant_id)), 0)::int;
END $function$;

-- Pastoral assignee check: helper with owner rights (so it can see unit lists), trigger with caller rights.
CREATE OR REPLACE FUNCTION public.is_pastoral_staff(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.rpc_probe_blocked('is_pastoral_staff', _user_id) THEN
    RETURN false;
  END IF;
  RETURN public.has_role(_user_id, 'super_admin'::app_role)
    OR public.is_admin(_user_id, _tenant_id)
    OR EXISTS (
      SELECT 1 FROM public.unit_leader_assignments ula
      WHERE ula.user_id = _user_id AND ula.tenant_id = _tenant_id
        AND lower(replace(ula.unit_name, ' ', '')) = 'pastoralcare')
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = _user_id AND m.tenant_id = _tenant_id
        AND lower(replace(coalesce(m.church_unit, ''), ' ', '')) LIKE '%pastoralcare%');
END $function$;

REVOKE ALL ON FUNCTION public.is_pastoral_staff(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_pastoral_staff(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_pastoral_assignee_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.assigned_to IS NOT NULL
     AND current_user IN ('authenticated','anon')
     AND (TG_OP = 'INSERT' OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id)
     AND NOT public.is_pastoral_staff(NEW.assigned_to, NEW.tenant_id) THEN
    RAISE EXCEPTION 'Pastoral care cases can only be assigned to the Pastoral Care team or a church admin';
  END IF;
  RETURN NEW;
END $function$;