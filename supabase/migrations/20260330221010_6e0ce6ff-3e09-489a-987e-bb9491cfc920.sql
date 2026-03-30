CREATE TABLE public.scheduled_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) NOT NULL,
  channel text NOT NULL,
  filters jsonb DEFAULT '{}',
  subject text,
  message text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  sent_at timestamptz,
  error_message text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.scheduled_communications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view scheduled communications"
  ON public.scheduled_communications FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Tenant admins can insert scheduled communications"
  ON public.scheduled_communications FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Tenant admins can update scheduled communications"
  ON public.scheduled_communications FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Tenant admins can delete scheduled communications"
  ON public.scheduled_communications FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()));