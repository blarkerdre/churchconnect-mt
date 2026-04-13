
CREATE TABLE public.call_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  caller_id uuid REFERENCES auth.users(id),
  member_id uuid REFERENCES public.members(id),
  recipient_phone text NOT NULL,
  call_type text DEFAULT 'outbound',
  duration_seconds integer,
  status text DEFAULT 'initiated',
  provider text DEFAULT 'twilio',
  provider_call_id text,
  reference_type text,
  reference_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.call_log ENABLE ROW LEVEL SECURITY;

-- Admins/leaders can view all call logs in their tenant
CREATE POLICY "Admins and leaders can view tenant call logs"
  ON public.call_log FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid(), tenant_id)
    OR public.has_role(auth.uid(), 'unit_leader'::app_role, tenant_id)
    OR public.has_role(auth.uid(), 'wsf_leader'::app_role, tenant_id)
  );

-- Members can view their own call logs
CREATE POLICY "Members can view own call logs"
  ON public.call_log FOR SELECT TO authenticated
  USING (caller_id = auth.uid() AND user_belongs_to_tenant(auth.uid(), tenant_id));

-- Authenticated users can insert call logs in their tenant
CREATE POLICY "Authenticated users can insert call logs"
  ON public.call_log FOR INSERT TO authenticated
  WITH CHECK (user_belongs_to_tenant(auth.uid(), tenant_id));

-- Service role can insert (for edge functions)
CREATE POLICY "Service role can insert call logs"
  ON public.call_log FOR INSERT TO service_role
  WITH CHECK (true);

CREATE INDEX idx_call_log_tenant_id ON public.call_log(tenant_id);
CREATE INDEX idx_call_log_member_id ON public.call_log(member_id);
CREATE INDEX idx_call_log_reference ON public.call_log(reference_type, reference_id);
