
-- 1) call_log: tighten service_role insert to require tenant_id
DROP POLICY IF EXISTS "Service role can insert call logs" ON public.call_log;
CREATE POLICY "Service role can insert call logs"
ON public.call_log
FOR INSERT
TO service_role
WITH CHECK (tenant_id IS NOT NULL);

-- 2) email_send_log: tighten member view policy — restrict to authenticated role,
-- match through the current user's own member record, and ensure email uniqueness
-- within the tenant so shared/stale emails don't leak across members.
DROP POLICY IF EXISTS "Members can view own received emails" ON public.email_send_log;
CREATE POLICY "Members can view own received emails"
ON public.email_send_log
FOR SELECT
TO authenticated
USING (
  user_has_tenant_access(tenant_id)
  AND EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = email_send_log.tenant_id
      AND lower(m.email) = lower(email_send_log.recipient_email)
  )
  AND (
    SELECT count(*) FROM public.members m2
    WHERE m2.tenant_id = email_send_log.tenant_id
      AND lower(m2.email) = lower(email_send_log.recipient_email)
  ) = 1
);

-- Also restrict email_send_log service-role policies to service_role explicitly
DROP POLICY IF EXISTS "Service role can insert send log" ON public.email_send_log;
CREATE POLICY "Service role can insert send log"
ON public.email_send_log
FOR INSERT
TO service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can read send log" ON public.email_send_log;
CREATE POLICY "Service role can read send log"
ON public.email_send_log
FOR SELECT
TO service_role
USING (true);

DROP POLICY IF EXISTS "Service role can update send log" ON public.email_send_log;
CREATE POLICY "Service role can update send log"
ON public.email_send_log
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- 3) Restrict policies with role=public to authenticated (defense in depth)

-- followup_scheduled_messages
DROP POLICY IF EXISTS "Admins manage followup messages" ON public.followup_scheduled_messages;
CREATE POLICY "Admins manage followup messages"
ON public.followup_scheduled_messages
FOR ALL
TO authenticated
USING (is_admin(auth.uid(), tenant_id))
WITH CHECK (is_admin(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Unit leaders manage own followup messages" ON public.followup_scheduled_messages;
CREATE POLICY "Unit leaders manage own followup messages"
ON public.followup_scheduled_messages
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'unit_leader'::app_role, tenant_id) AND created_by = auth.uid())
WITH CHECK (has_role(auth.uid(), 'unit_leader'::app_role, tenant_id) AND created_by = auth.uid());

-- member_claim_invites
DROP POLICY IF EXISTS "Admins create claim invites" ON public.member_claim_invites;
CREATE POLICY "Admins create claim invites"
ON public.member_claim_invites
FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Admins read claim invites" ON public.member_claim_invites;
CREATE POLICY "Admins read claim invites"
ON public.member_claim_invites
FOR SELECT
TO authenticated
USING (is_admin(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Admins update claim invites" ON public.member_claim_invites;
CREATE POLICY "Admins update claim invites"
ON public.member_claim_invites
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid(), tenant_id))
WITH CHECK (is_admin(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Invitee can read own claim invite" ON public.member_claim_invites;
CREATE POLICY "Invitee can read own claim invite"
ON public.member_claim_invites
FOR SELECT
TO authenticated
USING (
  member_id IN (
    SELECT members.id FROM public.members
    WHERE members.user_id = auth.uid()
      AND members.tenant_id = member_claim_invites.tenant_id
  )
);

-- sermon_notes
DROP POLICY IF EXISTS "Admins can view all tenant notes" ON public.sermon_notes;
CREATE POLICY "Admins can view all tenant notes"
ON public.sermon_notes
FOR SELECT
TO authenticated
USING (is_admin(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Users can create own notes" ON public.sermon_notes;
CREATE POLICY "Users can create own notes"
ON public.sermon_notes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete own notes" ON public.sermon_notes;
CREATE POLICY "Users can delete own notes"
ON public.sermon_notes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id AND user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update own notes" ON public.sermon_notes;
CREATE POLICY "Users can update own notes"
ON public.sermon_notes
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND user_has_tenant_access(tenant_id))
WITH CHECK (auth.uid() = user_id AND user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can view own notes" ON public.sermon_notes;
CREATE POLICY "Users can view own notes"
ON public.sermon_notes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id AND user_has_tenant_access(tenant_id));

-- push_subscriptions duplicate "public" policies (authenticated equivalents already exist)
DROP POLICY IF EXISTS "Users manage own push subs - delete" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users manage own push subs - insert" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users manage own push subs - select" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users manage own push subs - update" ON public.push_subscriptions;
