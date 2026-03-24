-- Allow super admins to manage tenant memberships across all tenants
CREATE POLICY "Super admins can manage all memberships"
ON public.tenant_memberships FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Allow super admins to view all profiles (needed for user lookup)
CREATE POLICY "Super admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));