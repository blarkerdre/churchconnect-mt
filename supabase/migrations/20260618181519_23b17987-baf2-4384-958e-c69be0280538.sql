
DROP POLICY IF EXISTS "Children update by guardian or admin" ON public.children;
CREATE POLICY "Children update by guardian or admin" ON public.children
FOR UPDATE TO authenticated
USING (
  public.is_admin(auth.uid(), tenant_id)
  OR public.is_child_primary_guardian(auth.uid(), id, tenant_id)
  OR public.is_child_co_parent(auth.uid(), id, tenant_id)
)
WITH CHECK (
  public.is_admin(auth.uid(), tenant_id)
  OR public.is_child_primary_guardian(auth.uid(), id, tenant_id)
  OR public.is_child_co_parent(auth.uid(), id, tenant_id)
);

DROP POLICY IF EXISTS "Leaders update availability" ON public.driver_availability;
CREATE POLICY "Leaders update availability"
ON public.driver_availability
FOR UPDATE TO authenticated
USING (
  user_has_tenant_access(tenant_id) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.unit_leader_assignments ula
      WHERE ula.user_id = auth.uid()
        AND ula.tenant_id = driver_availability.tenant_id
        AND ula.unit_name = ANY (ARRAY['Transportation'::text, 'Kingdom Chariot'::text])
    )
  )
)
WITH CHECK (
  user_has_tenant_access(tenant_id) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.unit_leader_assignments ula
      WHERE ula.user_id = auth.uid()
        AND ula.tenant_id = driver_availability.tenant_id
        AND ula.unit_name = ANY (ARRAY['Transportation'::text, 'Kingdom Chariot'::text])
    )
  )
);

DROP POLICY IF EXISTS "life_events_update" ON public.life_event_requests;
CREATE POLICY "life_events_update"
ON public.life_event_requests FOR UPDATE TO authenticated
USING (
  public.user_has_tenant_access(tenant_id) AND (
    auth.uid() = ANY(route_user_ids)
    OR public.is_altar_ministry_leader(auth.uid(), tenant_id)
    OR auth.uid() = assigned_owner_id
    OR public.is_admin(auth.uid(), tenant_id)
  )
)
WITH CHECK (
  public.user_has_tenant_access(tenant_id) AND (
    auth.uid() = ANY(route_user_ids)
    OR public.is_altar_ministry_leader(auth.uid(), tenant_id)
    OR auth.uid() = assigned_owner_id
    OR public.is_admin(auth.uid(), tenant_id)
  )
);
