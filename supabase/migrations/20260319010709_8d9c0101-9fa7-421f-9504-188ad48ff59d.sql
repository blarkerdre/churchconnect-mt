
-- Drop existing restrictive policies on training_reports
DROP POLICY IF EXISTS "Authorized users can manage training reports" ON public.training_reports;
DROP POLICY IF EXISTS "Authorized users can view training reports" ON public.training_reports;

-- Create new policies that allow all unit leaders
CREATE POLICY "Authorized users can manage training reports"
ON public.training_reports
FOR ALL
TO authenticated
USING (
  is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)
)
WITH CHECK (
  is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)
);

CREATE POLICY "Authorized users can view training reports"
ON public.training_reports
FOR SELECT
TO authenticated
USING (
  is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)
);

-- Drop existing restrictive policies on church_attendance_reports
DROP POLICY IF EXISTS "Authorized users can manage church attendance reports" ON public.church_attendance_reports;
DROP POLICY IF EXISTS "Authorized users can view church attendance reports" ON public.church_attendance_reports;

-- Create new policies that allow all unit leaders
CREATE POLICY "Authorized users can manage church attendance reports"
ON public.church_attendance_reports
FOR ALL
TO authenticated
USING (
  is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)
)
WITH CHECK (
  is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)
);

CREATE POLICY "Authorized users can view church attendance reports"
ON public.church_attendance_reports
FOR SELECT
TO authenticated
USING (
  is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)
);
