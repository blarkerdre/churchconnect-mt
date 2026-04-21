-- Allow users who can already read a follow-up to also read the member it points to.
-- This fixes "Unknown" appearing on the Follow-ups page for unit leaders, WSF leaders, and admins
-- when the follow-up is for a first-timer/visitor with no church_unit (so the unit-leader-for-member
-- policy doesn't match) and the leader is not the direct assignee.

CREATE POLICY "Followup viewers can view followup member"
ON public.members
FOR SELECT
TO authenticated
USING (
  user_has_tenant_access(tenant_id)
  AND EXISTS (
    SELECT 1
    FROM public.followups f
    WHERE f.member_id = members.id
      AND f.tenant_id = members.tenant_id
      AND (
        is_admin(auth.uid(), f.tenant_id)
        OR has_role(auth.uid(), 'unit_leader'::app_role, f.tenant_id)
        OR has_role(auth.uid(), 'wsf_leader'::app_role, f.tenant_id)
      )
  )
);