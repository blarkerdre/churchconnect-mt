
DROP POLICY IF EXISTS "Admins/leaders can manage pickup locations" ON public.pickup_locations;

CREATE POLICY "Admins/leaders can manage pickup locations"
ON public.pickup_locations
FOR ALL
TO authenticated
USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id))
WITH CHECK (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id));
