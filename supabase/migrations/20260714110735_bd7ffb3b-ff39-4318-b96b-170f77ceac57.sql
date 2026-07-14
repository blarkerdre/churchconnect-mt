DROP POLICY IF EXISTS consent_events_self_insert ON public.consent_events;
CREATE POLICY consent_events_self_insert
  ON public.consent_events FOR INSERT TO authenticated
  WITH CHECK (
    (user_id IS NULL OR user_id = auth.uid())
    AND (tenant_id IS NULL OR public.user_belongs_to_tenant(auth.uid(), tenant_id))
    AND (
      member_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.members m
        WHERE m.id = consent_events.member_id
          AND m.user_id = auth.uid()
      )
    )
  );