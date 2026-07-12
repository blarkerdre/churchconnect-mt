
DROP POLICY IF EXISTS "Tenant members can view attendees" ON public.training_attendees;

CREATE POLICY "Staff can view all attendees"
ON public.training_attendees
FOR SELECT
TO authenticated
USING (
  user_has_tenant_access(tenant_id)
  AND (
    is_admin(auth.uid(), tenant_id)
    OR is_training_rep_member(auth.uid(), tenant_id)
    OR is_training_rep_leader(auth.uid(), tenant_id)
    OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id)
  )
);

CREATE POLICY "Members can view their own attendee record"
ON public.training_attendees
FOR SELECT
TO authenticated
USING (
  user_has_tenant_access(tenant_id)
  AND member_id IN (
    SELECT m.id FROM public.members m
    WHERE m.user_id = auth.uid() AND m.tenant_id = training_attendees.tenant_id
  )
);
