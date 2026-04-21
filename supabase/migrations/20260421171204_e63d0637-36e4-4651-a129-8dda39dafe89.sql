-- Allow tenant admins/owners to manage tenant-scoped roles for their tenant.
-- This unblocks granting the 'admin' role from User Management.
-- 'super_admin' stays restricted to the existing super-admin policy.

DROP POLICY IF EXISTS "Admins can manage leader roles" ON public.user_roles;
DROP POLICY IF EXISTS "Tenant admins can manage tenant roles" ON public.user_roles;

CREATE POLICY "Tenant admins can manage tenant roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  public.is_admin(auth.uid(), tenant_id)
  AND role <> 'super_admin'::app_role
)
WITH CHECK (
  public.is_admin(auth.uid(), tenant_id)
  AND role <> 'super_admin'::app_role
  AND tenant_id IS NOT NULL
);