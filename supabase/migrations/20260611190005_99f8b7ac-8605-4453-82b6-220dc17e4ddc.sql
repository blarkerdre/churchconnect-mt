DROP POLICY IF EXISTS "View referrals: admins, referrer, assigned leader, followup tea" ON public.followup_referrals;

CREATE POLICY "View referrals: admins, referrer, assigned leader, followup tea"
ON public.followup_referrals
FOR SELECT
USING (
  user_belongs_to_tenant(auth.uid(), tenant_id)
  AND (
    is_admin(auth.uid(), tenant_id)
    OR referred_by = auth.uid()
    OR assigned_leader_id = auth.uid()
    OR is_followup_team_member(auth.uid(), tenant_id)
  )
);