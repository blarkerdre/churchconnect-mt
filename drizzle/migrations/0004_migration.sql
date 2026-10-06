CREATE OR REPLACE FUNCTION public.tenant_is_suspended(_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = _tenant_id AND lower(coalesce(t.subscription_status,'')) = 'suspended');
$$;
REVOKE ALL ON FUNCTION public.tenant_is_suspended(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tenant_is_suspended(uuid) TO authenticated;

DROP POLICY IF EXISTS "Suspended tenants restrict member directory" ON public.members;
CREATE POLICY "Suspended tenants restrict member directory" ON public.members
AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  NOT public.tenant_is_suspended(tenant_id)
  OR public.is_admin(auth.uid(), tenant_id)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR auth.uid() = user_id
);