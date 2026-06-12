DROP POLICY IF EXISTS "Members can view own completions" ON public.training_completions;
CREATE POLICY "Members can view own completions"
ON public.training_completions
FOR SELECT
USING (
  public.user_has_tenant_access(tenant_id)
  AND EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = training_completions.member_id
      AND m.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "View referral updates: admins, referrer, assigned leader, follo" ON public.followup_referral_updates;
CREATE POLICY "View referral updates: admins, referrer, assigned leader, follo"
ON public.followup_referral_updates
FOR SELECT
USING (
  public.is_admin(auth.uid(), tenant_id)
  OR public.is_followup_team_member(auth.uid(), tenant_id)
  OR (
    public.user_belongs_to_tenant(auth.uid(), tenant_id)
    AND EXISTS (
      SELECT 1 FROM public.followup_referrals r
      WHERE r.id = followup_referral_updates.referral_id
        AND (r.referred_by = auth.uid() OR r.assigned_leader_id = auth.uid())
    )
  )
);