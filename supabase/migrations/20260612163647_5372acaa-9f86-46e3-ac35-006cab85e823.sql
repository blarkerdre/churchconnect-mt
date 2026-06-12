CREATE TABLE public.driver_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  driver_user_id uuid NOT NULL,
  driver_member_id uuid,
  driver_unit text NOT NULL,
  available_date date NOT NULL,
  service_type text,
  pickup_area_address text NOT NULL,
  pickup_area_postcode text,
  seats_available integer NOT NULL DEFAULT 1 CHECK (seats_available >= 1),
  notes text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_driver_availability_tenant_date ON public.driver_availability(tenant_id, available_date);
CREATE INDEX idx_driver_availability_driver ON public.driver_availability(driver_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_availability TO authenticated;
GRANT ALL ON public.driver_availability TO service_role;

ALTER TABLE public.driver_availability ENABLE ROW LEVEL SECURITY;

-- Drivers manage their own rows (within their tenant)
CREATE POLICY "Drivers manage own availability"
ON public.driver_availability
FOR ALL
TO authenticated
USING (auth.uid() = driver_user_id AND public.user_has_tenant_access(tenant_id))
WITH CHECK (auth.uid() = driver_user_id AND public.user_has_tenant_access(tenant_id));

-- Transportation / Kingdom Chariot leaders and admins can view all rows in their tenant
CREATE POLICY "Leaders view all availability"
ON public.driver_availability
FOR SELECT
TO authenticated
USING (
  public.user_has_tenant_access(tenant_id) AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.unit_leader_assignments ula
      WHERE ula.user_id = auth.uid()
        AND ula.unit_name IN ('Transportation', 'Kingdom Chariot')
    )
  )
);

-- Leaders / admins can update (e.g., mark matched/cancelled)
CREATE POLICY "Leaders update availability"
ON public.driver_availability
FOR UPDATE
TO authenticated
USING (
  public.user_has_tenant_access(tenant_id) AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.unit_leader_assignments ula
      WHERE ula.user_id = auth.uid()
        AND ula.unit_name IN ('Transportation', 'Kingdom Chariot')
    )
  )
)
WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE TRIGGER trg_driver_availability_updated_at
BEFORE UPDATE ON public.driver_availability
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
