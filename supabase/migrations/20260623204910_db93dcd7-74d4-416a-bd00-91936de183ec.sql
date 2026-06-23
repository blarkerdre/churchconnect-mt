CREATE POLICY "Children church workers can view guardian members"
ON public.members
FOR SELECT
TO authenticated
USING (
  is_children_church_member(auth.uid(), tenant_id)
  AND (
    EXISTS (
      SELECT 1 FROM public.children c
      WHERE c.tenant_id = members.tenant_id
        AND c.primary_guardian_member_id = members.id
    )
    OR EXISTS (
      SELECT 1 FROM public.child_guardians g
      WHERE g.tenant_id = members.tenant_id
        AND g.member_id = members.id
    )
  )
);