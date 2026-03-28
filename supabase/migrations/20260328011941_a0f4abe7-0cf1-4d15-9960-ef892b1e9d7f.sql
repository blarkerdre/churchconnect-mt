CREATE POLICY "Super admins can view all tenant memberships"
ON public.tenant_memberships
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));