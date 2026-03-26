
DROP POLICY IF EXISTS "Anon can view tenant by slug" ON public.tenants;

CREATE OR REPLACE FUNCTION public.get_tenant_by_slug(_slug text)
RETURNS TABLE (id uuid, name text, slug text, logo_url text, settings jsonb)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    t.id, t.name, t.slug, t.logo_url,
    jsonb_build_object(
      'favicon_url', t.settings->'favicon_url',
      'og_image_url', t.settings->'og_image_url',
      'primary_color', t.settings->'primary_color',
      'sender_name', t.settings->'sender_name'
    ) AS settings
  FROM public.tenants t
  WHERE t.slug = _slug AND t.is_archived IS NOT TRUE
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_by_slug(text) TO anon, authenticated;
