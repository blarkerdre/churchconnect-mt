-- Allow super admins to view all tenants
CREATE POLICY "Super admins can view all tenants"
ON public.tenants FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Allow super admins to insert tenants
CREATE POLICY "Super admins can create tenants"
ON public.tenants FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));