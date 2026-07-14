CREATE OR REPLACE FUNCTION public.is_wsf_leader_for_centre(_user_id uuid, _centre_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.wsf_centres wc
    JOIN public.members m ON m.id = wc.leader_id OR m.id = wc.host_member_id
    WHERE wc.id = _centre_id
      AND m.user_id = _user_id
      AND m.tenant_id = wc.tenant_id
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_home_cell_leader_for_centre(_user_id uuid, _centre_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.wsf_centres wc
    JOIN public.members m ON m.id = wc.leader_id OR m.id = wc.host_member_id
    WHERE wc.id = _centre_id
      AND wc.tenant_id = _tenant_id
      AND m.user_id = _user_id
      AND m.tenant_id = _tenant_id
  );
$function$;