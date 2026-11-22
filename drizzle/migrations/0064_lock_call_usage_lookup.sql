REVOKE EXECUTE ON FUNCTION public.call_minutes_used(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.call_minutes_used(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.call_minutes_used(_tenant_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Signed-out callers never get usage; signed-in callers only for their own church.
  IF auth.uid() IS NULL THEN
    IF COALESCE(auth.role(), '') = 'anon' THEN
      RETURN 0;
    END IF;
  ELSIF NOT (public.has_role(auth.uid(), 'super_admin') OR public.user_has_tenant_access(_tenant_id)) THEN
    RETURN 0;
  END IF;
  RETURN COALESCE((SELECT sum(billable_minutes) FROM public.call_log
    WHERE tenant_id = _tenant_id AND created_at >= public.call_cycle_start(_tenant_id)), 0)::int;
END $function$;

REVOKE EXECUTE ON FUNCTION public.call_minutes_used(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.call_minutes_used(uuid) TO authenticated, service_role;