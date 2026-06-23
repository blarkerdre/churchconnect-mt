
-- Fix 1: Strengthen WITH CHECK on child_checkins update policy
DROP POLICY IF EXISTS "Workers update checkins" ON public.child_checkins;

CREATE POLICY "Workers update checkins"
ON public.child_checkins
FOR UPDATE
USING (public.is_children_church_member(auth.uid(), tenant_id))
WITH CHECK (public.is_children_church_member(auth.uid(), tenant_id));

-- Fix 2: Restrict guardian INSERT on child_pickup_delegations to actual guardians of the child
DROP POLICY IF EXISTS "Guardian issues delegation" ON public.child_pickup_delegations;

CREATE POLICY "Guardian issues delegation"
ON public.child_pickup_delegations
FOR INSERT
WITH CHECK (
  public.user_has_tenant_access(tenant_id)
  AND EXISTS (
    SELECT 1
    FROM public.children c
    JOIN public.members m ON m.tenant_id = c.tenant_id
    WHERE c.id = child_pickup_delegations.child_id
      AND c.tenant_id = child_pickup_delegations.tenant_id
      AND m.user_id = auth.uid()
      AND (
        c.primary_guardian_member_id = m.id
        OR EXISTS (
          SELECT 1 FROM public.child_guardians cg
          WHERE cg.child_id = c.id
            AND cg.member_id = m.id
        )
      )
  )
);
