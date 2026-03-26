
DROP POLICY IF EXISTS "Authenticated can view wsf reports" ON public.wsf_attendance_reports;

CREATE POLICY "Authenticated can view wsf reports"
ON public.wsf_attendance_reports
FOR SELECT
TO authenticated
USING (user_has_tenant_access(tenant_id));
