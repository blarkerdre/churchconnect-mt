-- Add explicit INSERT policy for wofbi_applications so RLS intent is documented.
-- Public applications are inserted via SECURITY DEFINER RPCs (bypass RLS).
-- Authenticated members inserting for themselves must match their own member_id/tenant.
-- Tenant admins may insert applications on behalf of applicants in their tenant.
DROP POLICY IF EXISTS "Applicants and admins can insert applications" ON public.wofbi_applications;
CREATE POLICY "Applicants and admins can insert applications"
ON public.wofbi_applications
FOR INSERT
TO authenticated
WITH CHECK (
  public.user_belongs_to_tenant(auth.uid(), tenant_id)
  AND (
    public.is_tenant_admin(auth.uid(), tenant_id)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      member_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.members m
        WHERE m.id = wofbi_applications.member_id
          AND m.user_id = auth.uid()
          AND m.tenant_id = wofbi_applications.tenant_id
      )
    )
  )
);