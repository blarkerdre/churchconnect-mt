-- Members can view SMS/WhatsApp messages sent to them
CREATE POLICY "Members can view own received sms"
ON public.sms_log FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = sms_log.recipient_member_id
    AND m.user_id = auth.uid()
  )
  AND user_has_tenant_access(tenant_id)
);

-- Members can view email logs sent to their email
CREATE POLICY "Members can view own received emails"
ON public.email_send_log FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.email = email_send_log.recipient_email
    AND m.user_id = auth.uid()
  )
  AND user_has_tenant_access(tenant_id)
);