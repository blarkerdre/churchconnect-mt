CREATE OR REPLACE FUNCTION public.get_dashboard_stats(_tenant_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
BEGIN
  IF _tenant_id IS NULL THEN
    RETURN json_build_object(
      'total', 0, 'first_timers', 0, 'new_this_month', 0,
      'water_baptism', 0, 'hs_baptism', 0, 'bfc_completed', 0, 'winners_satellite', 0
    );
  END IF;

  IF NOT public.user_has_tenant_access(auth.uid(), _tenant_id) THEN
    RAISE EXCEPTION 'access denied for tenant %', _tenant_id;
  END IF;

  SELECT json_build_object(
    'total', COUNT(*),
    'first_timers', COUNT(*) FILTER (WHERE membership_status = 'First Timer'),
    'new_this_month', COUNT(*) FILTER (
      WHERE created_at >= date_trunc('month', now())
        AND created_at <  date_trunc('month', now()) + interval '1 month'
    ),
    'water_baptism', COUNT(*) FILTER (WHERE water_baptism IS TRUE AND membership_status = 'Active'),
    'hs_baptism', COUNT(*) FILTER (WHERE holy_spirit_baptism IS TRUE AND membership_status = 'Active'),
    'bfc_completed', COUNT(*) FILTER (WHERE bfc_completed IS TRUE AND membership_status = 'Active'),
    'winners_satellite', COUNT(*) FILTER (WHERE winners_satellite IS TRUE AND membership_status = 'Active')
  ) INTO result
  FROM public.members
  WHERE tenant_id = _tenant_id;

  RETURN result;
END;
$function$;