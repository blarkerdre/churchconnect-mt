CREATE TABLE public.tenant_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  api_key text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  label text NOT NULL DEFAULT 'Default',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.tenant_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage API keys"
  ON public.tenant_api_keys FOR ALL TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));