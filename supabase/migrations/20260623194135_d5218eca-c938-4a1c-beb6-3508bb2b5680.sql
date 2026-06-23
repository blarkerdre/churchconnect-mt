
-- =========================================================
-- Pricing & Costing foundation
-- =========================================================

-- Helper: super-admin check (reuse has_role pattern)
-- Assumes public.has_role(uuid, app_role) and 'super_admin' enum exist.

-- ---------- pricing_plans ----------
CREATE TABLE IF NOT EXISTS public.pricing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_public boolean NOT NULL DEFAULT false,
  currency text NOT NULL DEFAULT 'GBP',
  base_price_monthly numeric(12,2) NOT NULL DEFAULT 0,
  base_price_annual numeric(12,2) NOT NULL DEFAULT 0,
  setup_fee numeric(12,2) NOT NULL DEFAULT 0,
  stripe_product_id text,
  stripe_price_id_monthly text,
  stripe_price_id_annual text,
  -- Included quotas
  included_members integer NOT NULL DEFAULT 0,
  included_storage_mb integer NOT NULL DEFAULT 0,
  included_sms integer NOT NULL DEFAULT 0,
  included_whatsapp integer NOT NULL DEFAULT 0,
  included_email integer NOT NULL DEFAULT 0,
  included_ai_calls integer NOT NULL DEFAULT 0,
  -- Overage unit prices
  overage_price_member numeric(12,4) NOT NULL DEFAULT 0,
  overage_price_storage_gb numeric(12,4) NOT NULL DEFAULT 0,
  overage_price_sms numeric(12,4) NOT NULL DEFAULT 0,
  overage_price_whatsapp numeric(12,4) NOT NULL DEFAULT 0,
  overage_price_email numeric(12,4) NOT NULL DEFAULT 0,
  overage_price_ai_call numeric(12,4) NOT NULL DEFAULT 0,
  -- Overage allow flags
  allow_overage_member boolean NOT NULL DEFAULT false,
  allow_overage_storage boolean NOT NULL DEFAULT false,
  allow_overage_sms boolean NOT NULL DEFAULT true,
  allow_overage_whatsapp boolean NOT NULL DEFAULT true,
  allow_overage_email boolean NOT NULL DEFAULT true,
  allow_overage_ai boolean NOT NULL DEFAULT true,
  -- Feature flags (jsonb keyed by module slug -> boolean)
  feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pricing_plans TO authenticated;
GRANT SELECT ON public.pricing_plans TO anon;
GRANT ALL ON public.pricing_plans TO service_role;

ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active pricing plans"
  ON public.pricing_plans FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins manage pricing plans"
  ON public.pricing_plans FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- ---------- pricing_cost_inputs ----------
CREATE TABLE IF NOT EXISTS public.pricing_cost_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric text NOT NULL,             -- 'sms','whatsapp','email','storage_gb','ai_call','member','base_infra'
  unit_cost numeric(12,6) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  target_margin_pct numeric(6,2) NOT NULL DEFAULT 50,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (metric, effective_from)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_cost_inputs TO authenticated;
GRANT ALL ON public.pricing_cost_inputs TO service_role;

ALTER TABLE public.pricing_cost_inputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage cost inputs"
  ON public.pricing_cost_inputs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- ---------- tenant_usage_counters ----------
CREATE TABLE IF NOT EXISTS public.tenant_usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  metric text NOT NULL,
  used numeric(14,4) NOT NULL DEFAULT 0,
  included numeric(14,4) NOT NULL DEFAULT 0,
  overage_units numeric(14,4) NOT NULL DEFAULT 0,
  overage_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, period_start, metric)
);

CREATE INDEX IF NOT EXISTS idx_usage_counters_tenant_period
  ON public.tenant_usage_counters (tenant_id, period_start);

GRANT SELECT ON public.tenant_usage_counters TO authenticated;
GRANT ALL ON public.tenant_usage_counters TO service_role;

ALTER TABLE public.tenant_usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members view their usage"
  ON public.tenant_usage_counters FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.user_has_tenant_access(tenant_id)
  );

CREATE POLICY "Super admins manage usage counters"
  ON public.tenant_usage_counters FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- ---------- tenant_overage_charges ----------
CREATE TABLE IF NOT EXISTS public.tenant_overage_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  metric text NOT NULL,
  quantity numeric(14,4) NOT NULL DEFAULT 0,
  unit_price numeric(12,4) NOT NULL DEFAULT 0,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  status text NOT NULL DEFAULT 'pending', -- pending|invoiced|reported_to_stripe|waived
  stripe_invoice_item_id text,
  invoice_id uuid REFERENCES public.tenant_invoices(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_overage_tenant_period
  ON public.tenant_overage_charges (tenant_id, period_start);

GRANT SELECT ON public.tenant_overage_charges TO authenticated;
GRANT ALL ON public.tenant_overage_charges TO service_role;

ALTER TABLE public.tenant_overage_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members view their overage"
  ON public.tenant_overage_charges FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.user_has_tenant_access(tenant_id)
  );

CREATE POLICY "Super admins manage overage charges"
  ON public.tenant_overage_charges FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- ---------- Extend tenants ----------
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS pricing_plan_id uuid REFERENCES public.pricing_plans(id) ON DELETE SET NULL;

-- ---------- Extend tenant_subscriptions ----------
ALTER TABLE public.tenant_subscriptions
  ADD COLUMN IF NOT EXISTS pricing_plan_id uuid REFERENCES public.pricing_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS billing_interval text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'manual';

-- ---------- updated_at triggers ----------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_pricing_plans_updated ON public.pricing_plans;
CREATE TRIGGER trg_pricing_plans_updated BEFORE UPDATE ON public.pricing_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_pricing_cost_inputs_updated ON public.pricing_cost_inputs;
CREATE TRIGGER trg_pricing_cost_inputs_updated BEFORE UPDATE ON public.pricing_cost_inputs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_usage_counters_updated ON public.tenant_usage_counters;
CREATE TRIGGER trg_usage_counters_updated BEFORE UPDATE ON public.tenant_usage_counters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_overage_charges_updated ON public.tenant_overage_charges;
CREATE TRIGGER trg_overage_charges_updated BEFORE UPDATE ON public.tenant_overage_charges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
