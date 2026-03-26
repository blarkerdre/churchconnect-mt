CREATE OR REPLACE FUNCTION public.user_has_tenant_access(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _tenant_id IS NULL THEN FALSE
    ELSE EXISTS (
      SELECT 1 FROM public.tenant_memberships
      WHERE user_id = auth.uid() AND tenant_id = _tenant_id
    )
  END
$$;