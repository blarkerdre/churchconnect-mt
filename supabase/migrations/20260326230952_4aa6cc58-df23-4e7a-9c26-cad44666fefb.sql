
DROP POLICY IF EXISTS "Public can view church units" ON public.church_units;

CREATE OR REPLACE FUNCTION public.get_active_church_unit_names(_tenant_slug text DEFAULT NULL)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT cu.id, cu.name
  FROM public.church_units cu
  WHERE cu.is_active = true
    AND (_tenant_slug IS NULL OR cu.tenant_id = (
      SELECT t.id FROM public.tenants t
      WHERE t.slug = _tenant_slug AND t.is_archived IS NOT TRUE
      LIMIT 1
    ))
  ORDER BY cu.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_church_unit_names(text) TO anon, authenticated;
