
-- Add subscription_status to tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'active';

-- Create tenant_subscriptions table
CREATE TABLE public.tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  billing_cycle text NOT NULL DEFAULT 'monthly',
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'GBP',
  next_due_date date NOT NULL,
  grace_period_days integer NOT NULL DEFAULT 7,
  stripe_customer_id text,
  stripe_subscription_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS: Super admins can do anything, tenant admins/owners can read their own
CREATE POLICY "Super admins full access on tenant_subscriptions"
  ON public.tenant_subscriptions FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Tenant admins can read own subscription"
  ON public.tenant_subscriptions FOR SELECT TO authenticated
  USING (
    public.is_tenant_admin(auth.uid(), tenant_id)
  );

-- Create tenant_payments table
CREATE TABLE public.tenant_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.tenant_subscriptions(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'GBP',
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text,
  stripe_payment_intent_id text,
  reference text,
  notes text,
  recorded_by uuid,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins full access on tenant_payments"
  ON public.tenant_payments FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Tenant admins can read own payments"
  ON public.tenant_payments FOR SELECT TO authenticated
  USING (
    public.is_tenant_admin(auth.uid(), tenant_id)
  );

CREATE POLICY "Tenant owners can insert payments"
  ON public.tenant_payments FOR INSERT TO authenticated
  WITH CHECK (
    public.is_tenant_admin(auth.uid(), tenant_id)
  );

-- Trigger: advance subscription on payment
CREATE OR REPLACE FUNCTION public.advance_subscription_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _sub record;
BEGIN
  IF NEW.status != 'completed' THEN RETURN NEW; END IF;

  SELECT * INTO _sub FROM public.tenant_subscriptions
  WHERE tenant_id = NEW.tenant_id AND is_active = true
  LIMIT 1;

  IF _sub IS NULL THEN RETURN NEW; END IF;

  -- Advance next_due_date
  UPDATE public.tenant_subscriptions
  SET next_due_date = CASE
    WHEN _sub.billing_cycle = 'yearly' THEN _sub.next_due_date + interval '1 year'
    ELSE _sub.next_due_date + interval '1 month'
  END,
  updated_at = now()
  WHERE id = _sub.id;

  -- Set tenant status back to active
  UPDATE public.tenants
  SET subscription_status = 'active'
  WHERE id = NEW.tenant_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_advance_subscription_on_payment
AFTER INSERT ON public.tenant_payments
FOR EACH ROW
EXECUTE FUNCTION public.advance_subscription_on_payment();

-- Updated_at trigger for subscriptions
CREATE TRIGGER trg_tenant_subscriptions_updated_at
BEFORE UPDATE ON public.tenant_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
