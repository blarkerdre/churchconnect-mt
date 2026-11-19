CREATE OR REPLACE FUNCTION public.create_tenant_owner(p_tenant_id uuid, p_user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _caller uuid := auth.uid();
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_role(_caller, 'super_admin'::app_role) THEN
    IF p_user_id <> _caller
       OR NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = p_tenant_id AND t.created_by = _caller)
       OR EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = p_tenant_id AND m.role = 'owner') THEN
      RAISE EXCEPTION 'Not authorized to assign a tenant owner' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO tenant_memberships (tenant_id, user_id, role)
  VALUES (p_tenant_id, p_user_id, 'owner')
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  INSERT INTO user_roles (user_id, role, tenant_id)
  VALUES (p_user_id, 'admin', p_tenant_id)
  ON CONFLICT (user_id, role, tenant_id) DO NOTHING;
END;
$function$;
REVOKE ALL ON FUNCTION public.create_tenant_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_tenant_owner(uuid, uuid) TO authenticated, service_role;