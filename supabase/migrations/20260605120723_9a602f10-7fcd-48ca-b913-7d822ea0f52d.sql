DROP POLICY IF EXISTS "Update referrals: admins, referrer, assigned leader" ON public.followup_referrals;

CREATE POLICY "Update referrals: admins, referrer, assigned leader"
ON public.followup_referrals
FOR UPDATE
USING (
  user_belongs_to_tenant(auth.uid(), tenant_id)
  AND (
    is_admin(auth.uid(), tenant_id)
    OR referred_by = auth.uid()
    OR assigned_leader_id = auth.uid()
  )
)
WITH CHECK (
  user_belongs_to_tenant(auth.uid(), tenant_id)
  AND (
    is_admin(auth.uid(), tenant_id)
    OR referred_by = auth.uid()
    OR assigned_leader_id = auth.uid()
  )
);