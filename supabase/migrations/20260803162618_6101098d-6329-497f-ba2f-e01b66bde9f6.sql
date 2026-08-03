CREATE OR REPLACE FUNCTION public.users_with_mfa(_tenant_id uuid)
RETURNS TABLE(user_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (_tenant_id IS NOT NULL AND public.is_admin(auth.uid(), _tenant_id))
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT f.user_id
  FROM auth.mfa_factors f
  WHERE f.status = 'verified'
    AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.user_belongs_to_tenant(f.user_id, _tenant_id)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.users_with_mfa(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.users_with_mfa(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.users_with_mfa(uuid) TO service_role;