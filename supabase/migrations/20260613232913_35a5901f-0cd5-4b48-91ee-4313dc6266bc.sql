
-- member_claim_invites: restrict to admins + invitee self-read
DROP POLICY IF EXISTS "Tenant members create claim invites" ON public.member_claim_invites;
DROP POLICY IF EXISTS "Tenant members read claim invites" ON public.member_claim_invites;
DROP POLICY IF EXISTS "Tenant members update claim invites" ON public.member_claim_invites;

CREATE POLICY "Admins read claim invites"
ON public.member_claim_invites FOR SELECT
USING (is_admin(auth.uid(), tenant_id));

CREATE POLICY "Invitee can read own claim invite"
ON public.member_claim_invites FOR SELECT
USING (
  member_id IN (
    SELECT id FROM public.members
    WHERE user_id = auth.uid() AND tenant_id = member_claim_invites.tenant_id
  )
);

CREATE POLICY "Admins create claim invites"
ON public.member_claim_invites FOR INSERT
WITH CHECK (is_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins update claim invites"
ON public.member_claim_invites FOR UPDATE
USING (is_admin(auth.uid(), tenant_id))
WITH CHECK (is_admin(auth.uid(), tenant_id));

-- followup_scheduled_messages: unit leaders limited to their own
DROP POLICY IF EXISTS "Admins/leaders can manage followup messages" ON public.followup_scheduled_messages;

CREATE POLICY "Admins manage followup messages"
ON public.followup_scheduled_messages FOR ALL
USING (is_admin(auth.uid(), tenant_id))
WITH CHECK (is_admin(auth.uid(), tenant_id));

CREATE POLICY "Unit leaders manage own followup messages"
ON public.followup_scheduled_messages FOR ALL
USING (
  has_role(auth.uid(), 'unit_leader'::app_role, tenant_id)
  AND created_by = auth.uid()
)
WITH CHECK (
  has_role(auth.uid(), 'unit_leader'::app_role, tenant_id)
  AND created_by = auth.uid()
);

-- call_log: unit/wsf leaders only see calls they initiated
DROP POLICY IF EXISTS "Admins and leaders can view tenant call logs" ON public.call_log;

CREATE POLICY "Admins view tenant call logs"
ON public.call_log FOR SELECT
USING (is_admin(auth.uid(), tenant_id));

CREATE POLICY "Leaders view own initiated call logs"
ON public.call_log FOR SELECT
USING (
  caller_id = auth.uid()
  AND (
    has_role(auth.uid(), 'unit_leader'::app_role, tenant_id)
    OR has_role(auth.uid(), 'wsf_leader'::app_role, tenant_id)
  )
);
