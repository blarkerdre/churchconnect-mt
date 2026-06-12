
-- Fix 1: driver_availability tenant isolation in leader policies
DROP POLICY IF EXISTS "Leaders view all availability" ON public.driver_availability;
DROP POLICY IF EXISTS "Leaders update availability" ON public.driver_availability;

CREATE POLICY "Leaders view all availability"
ON public.driver_availability
FOR SELECT
USING (
  user_has_tenant_access(tenant_id) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.unit_leader_assignments ula
      WHERE ula.user_id = auth.uid()
        AND ula.tenant_id = driver_availability.tenant_id
        AND ula.unit_name = ANY (ARRAY['Transportation'::text, 'Kingdom Chariot'::text])
    )
  )
);

CREATE POLICY "Leaders update availability"
ON public.driver_availability
FOR UPDATE
USING (
  user_has_tenant_access(tenant_id) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.unit_leader_assignments ula
      WHERE ula.user_id = auth.uid()
        AND ula.tenant_id = driver_availability.tenant_id
        AND ula.unit_name = ANY (ARRAY['Transportation'::text, 'Kingdom Chariot'::text])
    )
  )
)
WITH CHECK (user_has_tenant_access(tenant_id));

-- Fix 2: is_wsf_leader_for_centre must require leader and centre to share a tenant
CREATE OR REPLACE FUNCTION public.is_wsf_leader_for_centre(_user_id uuid, _centre_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.wsf_centres wc
    JOIN public.members m ON m.id = wc.leader_id
    WHERE wc.id = _centre_id
      AND m.user_id = _user_id
      AND m.tenant_id = wc.tenant_id
  )
$function$;
