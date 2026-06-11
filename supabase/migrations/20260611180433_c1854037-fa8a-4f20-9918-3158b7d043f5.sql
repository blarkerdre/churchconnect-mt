
-- New columns
ALTER TABLE public.transportation
  ADD COLUMN IF NOT EXISTS driver_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS passenger_acknowledged_at timestamptz;

-- Helper: is current user a member of the Transportation church_unit in this tenant
CREATE OR REPLACE FUNCTION public.is_transport_unit_member(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND church_unit ILIKE '%transport%'
  );
$$;

-- Broaden SELECT so transport unit members, assignees, and drivers can see bookings
DROP POLICY IF EXISTS "Users can view own transport" ON public.transportation;
CREATE POLICY "View transport bookings"
  ON public.transportation FOR SELECT
  TO authenticated
  USING (
    user_has_tenant_access(tenant_id) AND (
      auth.uid() = user_id
      OR auth.uid() = assigned_to
      OR auth.uid() = driver_user_id
      OR is_admin(auth.uid(), tenant_id)
      OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id)
      OR public.is_transport_unit_member(auth.uid(), tenant_id)
    )
  );

-- Allow assignee/driver to update (status/check-in fields) and passenger to acknowledge
DROP POLICY IF EXISTS "Assignee or driver can update transport" ON public.transportation;
CREATE POLICY "Assignee or driver can update transport"
  ON public.transportation FOR UPDATE
  TO authenticated
  USING (
    user_has_tenant_access(tenant_id) AND (
      auth.uid() = assigned_to OR auth.uid() = driver_user_id
    )
  )
  WITH CHECK (
    user_has_tenant_access(tenant_id) AND (
      auth.uid() = assigned_to OR auth.uid() = driver_user_id
    )
  );

DROP POLICY IF EXISTS "Passenger can acknowledge transport" ON public.transportation;
CREATE POLICY "Passenger can acknowledge transport"
  ON public.transportation FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND user_has_tenant_access(tenant_id))
  WITH CHECK (auth.uid() = user_id AND user_has_tenant_access(tenant_id));
