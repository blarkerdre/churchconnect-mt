CREATE POLICY "Suspended tenants restrict attendance history"
ON public.attendance_records
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  NOT public.tenant_is_suspended(tenant_id)
  OR public.is_admin(auth.uid(), tenant_id)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);