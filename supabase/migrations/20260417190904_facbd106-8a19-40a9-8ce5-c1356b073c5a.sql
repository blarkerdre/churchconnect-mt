CREATE POLICY "Super admins can update any tenant"
ON public.tenants FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can delete any tenant"
ON public.tenants FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));