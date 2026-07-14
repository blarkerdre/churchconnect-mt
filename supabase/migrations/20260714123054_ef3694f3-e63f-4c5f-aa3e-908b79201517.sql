
-- 1. attendance_records self check-in: restrict to authenticated
DROP POLICY IF EXISTS "Members can self check-in" ON public.attendance_records;
CREATE POLICY "Members can self check-in"
ON public.attendance_records
FOR INSERT
TO authenticated
WITH CHECK (
  (EXISTS (SELECT 1 FROM public.members
           WHERE members.id = attendance_records.member_id
             AND members.user_id = auth.uid()))
  AND user_has_tenant_access(tenant_id)
  AND member_eligible_for_session(member_id, session_id)
);

-- 2. email_unsubscribe_tokens: restrict service-role-only policies to service_role role
DROP POLICY IF EXISTS "Service role can insert tokens" ON public.email_unsubscribe_tokens;
DROP POLICY IF EXISTS "Service role can mark tokens as used" ON public.email_unsubscribe_tokens;
DROP POLICY IF EXISTS "Service role can read tokens" ON public.email_unsubscribe_tokens;
CREATE POLICY "Service role can insert tokens"
ON public.email_unsubscribe_tokens FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can mark tokens as used"
ON public.email_unsubscribe_tokens FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role can read tokens"
ON public.email_unsubscribe_tokens FOR SELECT TO service_role USING (true);

-- 3. suppressed_emails: same tightening
DROP POLICY IF EXISTS "Service role can insert suppressed emails" ON public.suppressed_emails;
DROP POLICY IF EXISTS "Service role can read suppressed emails" ON public.suppressed_emails;
CREATE POLICY "Service role can insert suppressed emails"
ON public.suppressed_emails FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can read suppressed emails"
ON public.suppressed_emails FOR SELECT TO service_role USING (true);

-- 4. email_send_log: remove member self-view policy that relied on email matching.
--    Users can retrieve their emails via admin views; this eliminates cross-member
--    PII exposure risk on email address collisions.
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
      AND NOT EXISTS (
        SELECT 1 FROM public.members m2
        WHERE m2.tenant_id = email_send_log.tenant_id
          AND m2.id <> m.id
          AND lower(m2.email) = lower(email_send_log.recipient_email)
      )
  )
);

-- 5. profiles: scope unit_leader visibility to only members of units they lead
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Tenant admins: full visibility inside their tenant
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = profiles.user_id
      AND is_admin(auth.uid(), m.tenant_id)
  )
  -- Unit leaders: only members of a unit they lead
  OR EXISTS (
    SELECT 1
    FROM public.members m
    JOIN public.unit_leader_assignments ula
      ON ula.tenant_id = m.tenant_id
     AND ula.user_id = auth.uid()
     AND ula.unit_name = m.church_unit
    WHERE m.user_id = profiles.user_id
      AND has_role(auth.uid(), 'unit_leader'::app_role, m.tenant_id)
  )
);

-- 6. training_completions: restrict member self-view to authenticated
DROP POLICY IF EXISTS "Members can view own completions" ON public.training_completions;
CREATE POLICY "Members can view own completions"
ON public.training_completions
FOR SELECT
TO authenticated
USING (
  user_has_tenant_access(tenant_id)
  AND EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = training_completions.member_id
      AND m.user_id = auth.uid()
  )
);
