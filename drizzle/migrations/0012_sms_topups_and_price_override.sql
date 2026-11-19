ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS sms_unit_price_override numeric;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS sms_credit_balance integer NOT NULL DEFAULT 0;

CREATE TABLE public.sms_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  quantity integer NOT NULL,
  unit_price numeric NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'GBP',
  stripe_session_id text UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
GRANT SELECT ON public.sms_topups TO authenticated;
GRANT ALL ON public.sms_topups TO service_role;
ALTER TABLE public.sms_topups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant admins and super admins read sms topups" ON public.sms_topups FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR EXISTS (
  SELECT 1 FROM public.tenant_memberships tm WHERE tm.tenant_id = sms_topups.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin')));

CREATE TABLE public.sms_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sms_credit_ledger_tenant_time ON public.sms_credit_ledger(tenant_id, created_at);
GRANT SELECT ON public.sms_credit_ledger TO authenticated;
GRANT ALL ON public.sms_credit_ledger TO service_role;
ALTER TABLE public.sms_credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant admins and super admins read sms ledger" ON public.sms_credit_ledger FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR EXISTS (
  SELECT 1 FROM public.tenant_memberships tm WHERE tm.tenant_id = sms_credit_ledger.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin')));

CREATE OR REPLACE FUNCTION public.consume_sms_credits(_tenant_id uuid, _n integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE taken integer;
BEGIN
  IF _n <= 0 THEN RETURN 0; END IF;
  UPDATE public.tenants SET sms_credit_balance = sms_credit_balance - LEAST(sms_credit_balance, _n)
  WHERE id = _tenant_id
  RETURNING _n - GREATEST(0, _n - (sms_credit_balance + LEAST(sms_credit_balance + 0, 0))) INTO taken;
  RETURN 0;
END $$;

CREATE OR REPLACE FUNCTION public.consume_sms_credits(_tenant_id uuid, _n integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bal integer; taken integer;
BEGIN
  IF _n <= 0 THEN RETURN 0; END IF;
  SELECT sms_credit_balance INTO bal FROM public.tenants WHERE id = _tenant_id FOR UPDATE;
  taken := LEAST(COALESCE(bal,0), _n);
  IF taken > 0 THEN
    UPDATE public.tenants SET sms_credit_balance = sms_credit_balance - taken WHERE id = _tenant_id;
    INSERT INTO public.sms_credit_ledger(tenant_id, delta, reason) VALUES (_tenant_id, -taken, 'send');
  END IF;
  RETURN taken;
END $$;

CREATE OR REPLACE FUNCTION public.add_sms_credits_for_topup(_session_id text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.sms_topups;
BEGIN
  UPDATE public.sms_topups SET status = 'paid', paid_at = now()
  WHERE stripe_session_id = _session_id AND status <> 'paid' RETURNING * INTO t;
  IF t.id IS NULL THEN RETURN 0; END IF;
  UPDATE public.tenants SET sms_credit_balance = sms_credit_balance + t.quantity WHERE id = t.tenant_id;
  INSERT INTO public.sms_credit_ledger(tenant_id, delta, reason) VALUES (t.tenant_id, t.quantity, 'topup');
  RETURN t.quantity;
END $$;

REVOKE ALL ON FUNCTION public.consume_sms_credits(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_sms_credits_for_topup(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_sms_credits(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_sms_credits_for_topup(text) TO service_role;