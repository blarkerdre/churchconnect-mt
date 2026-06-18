-- Allow co-parents (linked via child_guardians with relationship='Parent') to read, update, and delete their children

CREATE POLICY "Co-parents read linked children"
ON public.children
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.child_guardians cg
    JOIN public.members m ON m.id = cg.member_id
    WHERE cg.child_id = children.id
      AND cg.tenant_id = children.tenant_id
      AND cg.relationship = 'Parent'
      AND m.user_id = auth.uid()
      AND m.tenant_id = children.tenant_id
  )
);

CREATE POLICY "Co-parents update linked children"
ON public.children
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.child_guardians cg
    JOIN public.members m ON m.id = cg.member_id
    WHERE cg.child_id = children.id
      AND cg.tenant_id = children.tenant_id
      AND cg.relationship = 'Parent'
      AND m.user_id = auth.uid()
      AND m.tenant_id = children.tenant_id
  )
);

CREATE POLICY "Co-parents delete linked children"
ON public.children
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.child_guardians cg
    JOIN public.members m ON m.id = cg.member_id
    WHERE cg.child_id = children.id
      AND cg.tenant_id = children.tenant_id
      AND cg.relationship = 'Parent'
      AND m.user_id = auth.uid()
      AND m.tenant_id = children.tenant_id
  )
);