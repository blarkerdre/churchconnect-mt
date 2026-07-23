DROP POLICY IF EXISTS "Read delegations for own children or workers" ON public.child_pickup_delegations;
CREATE POLICY "Read delegations for own children or workers"
ON public.child_pickup_delegations
FOR SELECT
TO authenticated
USING (
  (EXISTS (SELECT 1 FROM members m WHERE m.id = child_pickup_delegations.issued_by_member_id AND m.user_id = auth.uid()))
  OR is_admin(auth.uid(), tenant_id)
  OR (
    is_children_church_member(auth.uid(), tenant_id)
    AND valid_on = CURRENT_DATE
    AND used_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
    AND EXISTS (
      SELECT 1 FROM child_checkins ck
      WHERE ck.child_id = child_pickup_delegations.child_id
        AND ck.tenant_id = child_pickup_delegations.tenant_id
        AND ck.service_date = CURRENT_DATE
        AND ck.pickup_at IS NULL
    )
  )
);

DROP POLICY IF EXISTS "Members cancel own pending requests" ON public.unit_join_requests;
CREATE POLICY "Members cancel own pending requests"
ON public.unit_join_requests
FOR UPDATE
TO authenticated
USING (
  status = 'pending'
  AND EXISTS (SELECT 1 FROM members m WHERE m.id = unit_join_requests.member_id AND m.user_id = auth.uid() AND m.tenant_id = unit_join_requests.tenant_id)
)
WITH CHECK (
  status = 'cancelled'
  AND EXISTS (SELECT 1 FROM members m WHERE m.id = unit_join_requests.member_id AND m.user_id = auth.uid() AND m.tenant_id = unit_join_requests.tenant_id)
);