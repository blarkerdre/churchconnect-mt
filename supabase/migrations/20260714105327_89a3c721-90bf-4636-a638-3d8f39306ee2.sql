CREATE POLICY "Admins can delete tenant ratings"
ON public.lecturer_ratings
FOR DELETE
TO authenticated
USING (
  user_has_tenant_access(tenant_id) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = lecturer_ratings.tenant_id
        AND tm.role = ANY (ARRAY['owner'::tenant_role, 'admin'::tenant_role])
    )
  )
);