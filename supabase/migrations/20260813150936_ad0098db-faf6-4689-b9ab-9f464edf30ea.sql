CREATE POLICY "Tenant admins can view profiles of their church members"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.user_id = profiles.user_id
      AND (
        public.is_tenant_admin(auth.uid(), tm.tenant_id)
        OR public.is_admin(auth.uid(), tm.tenant_id)
      )
  )
);