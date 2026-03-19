
-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- Create a new policy: only super_admins can insert/update/delete roles
CREATE POLICY "Super admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
