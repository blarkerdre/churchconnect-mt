CREATE OR REPLACE FUNCTION public.is_child_primary_guardian(_user_id uuid, _child_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.children c
    JOIN public.members m ON m.id = c.primary_guardian_member_id
    WHERE c.id = _child_id
      AND c.tenant_id = _tenant_id
      AND m.tenant_id = _tenant_id
      AND m.user_id = _user_id
  );
$function$;