CREATE POLICY "Assigned followup users can view followup member"
ON public.members
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.followups f
    WHERE f.member_id = members.id
      AND f.assigned_to = auth.uid()
      AND f.tenant_id = members.tenant_id
  )
  AND user_has_tenant_access(tenant_id)
);