
-- Harden single-arg has_role: super_admin only counts when tenant_id IS NULL (platform-wide).
-- Defense in depth against tenant-scoped super_admin rows being treated as platform admins.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (
        _role <> 'super_admin'::app_role
        OR tenant_id IS NULL
      )
  )
$function$;
