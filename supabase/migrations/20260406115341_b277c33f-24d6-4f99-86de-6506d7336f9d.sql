
DROP POLICY IF EXISTS "Tenant members can view scheduled communications"
  ON public.scheduled_communications;

CREATE POLICY "Admins/leaders can view scheduled communications"
  ON public.scheduled_communications
  FOR SELECT TO authenticated
  USING (
    is_admin(auth.uid(), tenant_id)
    OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id)
  );
