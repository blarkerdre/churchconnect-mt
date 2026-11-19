DROP POLICY IF EXISTS "Super admins can view audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "Tenant admins can view their audit log" ON public.audit_log;
CREATE POLICY "Super admins can view audit logs" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));
CREATE POLICY "Tenant admins can view their audit log" ON public.audit_log FOR SELECT TO authenticated
  USING (tenant_id IS NOT NULL AND user_id IS NOT NULL AND coalesce(details->>'module','') <> ''
    AND ((public.is_admin(auth.uid(), tenant_id) AND public.user_has_tenant_access(tenant_id))
         OR public.is_tenant_admin(auth.uid(), tenant_id)));