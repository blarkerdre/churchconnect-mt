-- Allow tenant admins to manage non-admin roles (unit_leader, wsf_leader) within their tenant
CREATE POLICY "Admins can manage leader roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  public.is_admin(auth.uid(), tenant_id)
  AND role IN ('unit_leader', 'wsf_leader')
)
WITH CHECK (
  public.is_admin(auth.uid(), tenant_id)
  AND role IN ('unit_leader', 'wsf_leader')
);