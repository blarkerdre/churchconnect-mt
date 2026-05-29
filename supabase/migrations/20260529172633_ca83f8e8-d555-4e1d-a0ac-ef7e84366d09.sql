CREATE POLICY "Super admins can manage global super_admin rows"
ON public.user_roles
AS PERMISSIVE
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) AND role = 'super_admin'::app_role AND tenant_id IS NULL)
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) AND role = 'super_admin'::app_role AND tenant_id IS NULL);