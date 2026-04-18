
-- Allow an assigned referral leader to update the referred member's
-- church_unit (for unit_leader referrals) or wsf_centre_id / winners_satellite
-- (for home_cell_leader referrals), even if the member is not yet in their
-- unit/centre. This is required so leaders can accept signposted members.

CREATE OR REPLACE FUNCTION public.is_assigned_referral_leader_for_member(_user_id uuid, _member_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.followup_referrals r
    WHERE r.assigned_leader_id = _user_id
      AND r.member_id = _member_id
      AND r.tenant_id = _tenant_id
      AND r.status <> 'closed'
  );
$$;

DROP POLICY IF EXISTS "Assigned referral leaders can update referred member" ON public.members;
CREATE POLICY "Assigned referral leaders can update referred member"
ON public.members
FOR UPDATE
TO authenticated
USING (public.is_assigned_referral_leader_for_member(auth.uid(), id, tenant_id))
WITH CHECK (public.is_assigned_referral_leader_for_member(auth.uid(), id, tenant_id));

-- Also let assigned leaders SELECT the member they were referred (so contact card loads)
DROP POLICY IF EXISTS "Assigned referral leaders can view referred member" ON public.members;
CREATE POLICY "Assigned referral leaders can view referred member"
ON public.members
FOR SELECT
TO authenticated
USING (public.is_assigned_referral_leader_for_member(auth.uid(), id, tenant_id));
