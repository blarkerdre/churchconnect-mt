
CREATE TABLE public.purged_data_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  purged_by uuid NOT NULL,
  purged_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  status text NOT NULL DEFAULT 'archived',
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.purged_data_archives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage archives"
  ON public.purged_data_archives FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') AND public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') AND public.user_has_tenant_access(tenant_id));
