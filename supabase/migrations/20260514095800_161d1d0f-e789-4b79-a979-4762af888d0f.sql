CREATE OR REPLACE FUNCTION public.user_is_followup_unit_member(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    JOIN public.church_units cu
      ON cu.tenant_id = m.tenant_id
     AND lower(cu.name) = lower(m.church_unit)
    WHERE m.user_id = _user_id
      AND m.tenant_id = _tenant_id
      AND cu.is_active = true
      AND (
        cu.name ILIKE '%follow%up%'
        OR cu.name ILIKE 'follow up'
        OR cu.name ILIKE 'followup'
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_is_followup_unit_member(uuid, uuid) TO authenticated, service_role;