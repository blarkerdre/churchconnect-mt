ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS billing_currency text NOT NULL DEFAULT 'GBP';
UPDATE public.tenants t SET billing_currency = upper(coalesce(
  (SELECT s.currency FROM public.tenant_subscriptions s WHERE s.tenant_id = t.id ORDER BY s.created_at DESC LIMIT 1),
  (SELECT p.currency FROM public.pricing_plans p WHERE p.id = t.pricing_plan_id), 'GBP'));
UPDATE public.tenants SET billing_currency = 'GBP' WHERE billing_currency NOT IN ('GBP','USD','EUR','NGN','CAD');
ALTER TABLE public.tenants ADD CONSTRAINT tenants_billing_currency_check CHECK (billing_currency IN ('GBP','USD','EUR','NGN','CAD'));