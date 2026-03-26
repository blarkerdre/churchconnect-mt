-- Drop the overly broad ALL policy
DROP POLICY IF EXISTS "Admins can manage invitations" ON public.tenant_invitations;

-- SELECT: tenant-scoped admins + super_admins
CREATE POLICY "Admins can view tenant invitations"
ON public.tenant_invitations
FOR SELECT
TO authenticated
USING (
  is_tenant_admin(auth.uid(), tenant_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- INSERT: tenant-scoped admins + super_admins
CREATE POLICY "Admins can create tenant invitations"
ON public.tenant_invitations
FOR INSERT
TO authenticated
WITH CHECK (
  is_tenant_admin(auth.uid(), tenant_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- UPDATE: tenant-scoped admins + super_admins
CREATE POLICY "Admins can update tenant invitations"
ON public.tenant_invitations
FOR UPDATE
TO authenticated
USING (
  is_tenant_admin(auth.uid(), tenant_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  is_tenant_admin(auth.uid(), tenant_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- DELETE: tenant-scoped admins + super_admins
CREATE POLICY "Admins can delete tenant invitations"
ON public.tenant_invitations
FOR DELETE
TO authenticated
USING (
  is_tenant_admin(auth.uid(), tenant_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);