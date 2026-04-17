ALTER TABLE public.tenant_subscriptions
  ADD COLUMN IF NOT EXISTS setup_fee_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS setup_fee_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS setup_fee_paid_at timestamptz;