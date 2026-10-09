CREATE OR REPLACE FUNCTION public.is_tenant_owner(_user_id uuid, _tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.tenant_memberships WHERE user_id = _user_id AND tenant_id = _tenant_id AND role = 'owner')
$$;
REVOKE ALL ON FUNCTION public.is_tenant_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tenant_owner(uuid, uuid) TO authenticated;
CREATE POLICY "Tenant owners can manage admin role" ON public.user_roles FOR ALL TO authenticated
USING (tenant_id IS NOT NULL AND role = 'admin'::app_role AND public.is_tenant_owner(auth.uid(), tenant_id))
WITH CHECK (tenant_id IS NOT NULL AND role = 'admin'::app_role AND public.is_tenant_owner(auth.uid(), tenant_id));