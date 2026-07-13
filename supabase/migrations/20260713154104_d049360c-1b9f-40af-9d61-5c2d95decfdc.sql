
-- 1) SLA templates (global, super-admin managed)
CREATE TABLE public.sla_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version INT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT 'Service Level Agreement',
  body_html TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sla_templates TO authenticated;
GRANT ALL ON public.sla_templates TO service_role;

ALTER TABLE public.sla_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read SLA templates"
  ON public.sla_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins manage SLA templates - insert"
  ON public.sla_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins manage SLA templates - update"
  ON public.sla_templates FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins manage SLA templates - delete"
  ON public.sla_templates FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Auto-manage version + single active row
CREATE OR REPLACE FUNCTION public.sla_templates_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.version IS NULL OR NEW.version = 0 THEN
    SELECT COALESCE(MAX(version), 0) + 1 INTO NEW.version FROM public.sla_templates;
  END IF;
  IF NEW.is_active THEN
    UPDATE public.sla_templates SET is_active = false WHERE is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sla_templates_before_insert
BEFORE INSERT ON public.sla_templates
FOR EACH ROW EXECUTE FUNCTION public.sla_templates_before_insert();

CREATE OR REPLACE FUNCTION public.sla_templates_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.is_active AND NOT OLD.is_active THEN
    UPDATE public.sla_templates SET is_active = false WHERE is_active = true AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sla_templates_before_update
BEFORE UPDATE ON public.sla_templates
FOR EACH ROW EXECUTE FUNCTION public.sla_templates_before_update();

-- 2) SLA signatures (immutable ledger, per tenant)
CREATE TABLE public.tenant_sla_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_version INT NOT NULL,
  signed_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  signed_by_name TEXT NOT NULL,
  signed_by_email TEXT,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  merged_body_html TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenant_sla_signatures_tenant ON public.tenant_sla_signatures(tenant_id, signed_at DESC);

GRANT SELECT, INSERT ON public.tenant_sla_signatures TO authenticated;
GRANT ALL ON public.tenant_sla_signatures TO service_role;

ALTER TABLE public.tenant_sla_signatures ENABLE ROW LEVEL SECURITY;

-- Read: tenant owners/admins of the tenant, or super admins
CREATE POLICY "Tenant admins can read their SLA signatures"
  ON public.tenant_sla_signatures FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.tenant_id = tenant_sla_signatures.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin')
    )
  );

-- Insert: only the tenant owner, signing for themselves and their tenant
CREATE POLICY "Tenant owner can sign SLA"
  ON public.tenant_sla_signatures FOR INSERT
  TO authenticated
  WITH CHECK (
    signed_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.tenant_id = tenant_sla_signatures.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'owner'
    )
  );

-- No UPDATE / DELETE policies -> immutable
