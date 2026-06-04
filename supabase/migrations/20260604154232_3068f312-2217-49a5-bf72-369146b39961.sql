
DROP POLICY IF EXISTS "Authorized users can view training reports" ON public.training_reports;
DROP POLICY IF EXISTS "Authorized users can manage training reports" ON public.training_reports;

CREATE POLICY "Authorized users can view training reports"
ON public.training_reports
FOR SELECT
TO authenticated
USING (
  is_admin(auth.uid(), tenant_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id)
  OR has_role(auth.uid(), 'reports_officer'::app_role, tenant_id)
  OR user_is_unit_member(auth.uid(), 'Training Rep', tenant_id)
);

CREATE POLICY "Authorized users can manage training reports"
ON public.training_reports
FOR ALL
TO authenticated
USING (
  is_admin(auth.uid(), tenant_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id)
  OR user_is_unit_member(auth.uid(), 'Training Rep', tenant_id)
)
WITH CHECK (
  is_admin(auth.uid(), tenant_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id)
  OR user_is_unit_member(auth.uid(), 'Training Rep', tenant_id)
);
