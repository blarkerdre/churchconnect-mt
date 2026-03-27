
-- Fix wsf_zones: replace single-arg is_admin with tenant-scoped
DROP POLICY IF EXISTS "Admins can manage wsf_zones" ON public.wsf_zones;
CREATE POLICY "Admins can manage wsf_zones"
ON public.wsf_zones
FOR ALL
TO authenticated
USING (is_admin(auth.uid(), tenant_id))
WITH CHECK (is_admin(auth.uid(), tenant_id));

-- Fix exam_subjects: replace single-arg is_admin with tenant-scoped
DROP POLICY IF EXISTS "Admins can manage exam subjects" ON public.exam_subjects;
CREATE POLICY "Admins can manage exam subjects"
ON public.exam_subjects
FOR ALL
TO authenticated
USING (is_admin(auth.uid(), tenant_id))
WITH CHECK (is_admin(auth.uid(), tenant_id));

-- Fix user_roles: replace single-arg is_admin with tenant-scoped in SELECT
DROP POLICY IF EXISTS "Admins can view user roles" ON public.user_roles;
CREATE POLICY "Admins can view user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (is_admin(auth.uid(), tenant_id));
