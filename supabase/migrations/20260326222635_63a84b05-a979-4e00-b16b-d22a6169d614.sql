DROP POLICY IF EXISTS "Public can view wsf centres" ON public.wsf_centres;

CREATE OR REPLACE FUNCTION public.get_active_wsf_centre_names()
RETURNS TABLE (id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id, name FROM public.wsf_centres
  WHERE is_active = true ORDER BY name;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_wsf_centre_names() TO anon, authenticated;