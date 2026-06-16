
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  email text,
  phone text,
  tags text[] NOT NULL DEFAULT '{}',
  notes text,
  source text NOT NULL DEFAULT 'manual',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contacts_tenant ON public.contacts(tenant_id);
CREATE UNIQUE INDEX idx_contacts_tenant_email ON public.contacts(tenant_id, lower(email)) WHERE email IS NOT NULL;
CREATE INDEX idx_contacts_tags ON public.contacts USING gin(tags);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can view contacts"
  ON public.contacts FOR SELECT TO authenticated
  USING (
    public.user_has_tenant_access(tenant_id)
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.tenant_memberships tm
        WHERE tm.tenant_id = contacts.tenant_id
          AND tm.user_id = auth.uid()
          AND tm.role IN ('owner','admin')
      )
    )
  );

CREATE POLICY "Tenant admins can insert contacts"
  ON public.contacts FOR INSERT TO authenticated
  WITH CHECK (
    public.user_has_tenant_access(tenant_id)
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.tenant_memberships tm
        WHERE tm.tenant_id = contacts.tenant_id
          AND tm.user_id = auth.uid()
          AND tm.role IN ('owner','admin')
      )
    )
  );

CREATE POLICY "Tenant admins can update contacts"
  ON public.contacts FOR UPDATE TO authenticated
  USING (
    public.user_has_tenant_access(tenant_id)
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.tenant_memberships tm
        WHERE tm.tenant_id = contacts.tenant_id
          AND tm.user_id = auth.uid()
          AND tm.role IN ('owner','admin')
      )
    )
  );

CREATE POLICY "Tenant admins can delete contacts"
  ON public.contacts FOR DELETE TO authenticated
  USING (
    public.user_has_tenant_access(tenant_id)
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.tenant_memberships tm
        WHERE tm.tenant_id = contacts.tenant_id
          AND tm.user_id = auth.uid()
          AND tm.role IN ('owner','admin')
      )
    )
  );

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.scheduled_communications
  ADD COLUMN IF NOT EXISTS audience_source text;
