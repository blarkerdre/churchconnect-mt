
CREATE OR REPLACE FUNCTION public.search_tenant_members_for_guardian(_tenant_id uuid, _q text)
RETURNS TABLE (id uuid, first_name text, last_name text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.first_name, m.last_name, m.email
  FROM public.members m
  WHERE m.tenant_id = _tenant_id
    AND public.user_has_tenant_access(_tenant_id)
    AND length(btrim(coalesce(_q, ''))) >= 2
    AND (
      m.first_name ILIKE '%' || _q || '%'
      OR m.last_name  ILIKE '%' || _q || '%'
      OR m.email      ILIKE '%' || _q || '%'
    )
  ORDER BY m.first_name, m.last_name
  LIMIT 10;
$$;

REVOKE ALL ON FUNCTION public.search_tenant_members_for_guardian(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_tenant_members_for_guardian(uuid, text) TO authenticated;
