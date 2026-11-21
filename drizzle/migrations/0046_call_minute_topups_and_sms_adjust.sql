CREATE TABLE public.call_minute_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  minutes integer NOT NULL CHECK (minutes > 0),
  unit_price numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  stripe_session_id text UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.call_minute_topups TO authenticated;
GRANT ALL ON public.call_minute_topups TO service_role;
ALTER TABLE public.call_minute_topups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Church admins and super admins read call topups" ON public.call_minute_topups FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR EXISTS (
  SELECT 1 FROM public.tenant_memberships tm WHERE tm.tenant_id = call_minute_topups.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin')));

CREATE OR REPLACE FUNCTION public.add_call_minutes_for_topup(_session_id text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record;
BEGIN
  UPDATE public.call_minute_topups SET status = 'paid', paid_at = now()
    WHERE stripe_session_id = _session_id AND status = 'pending' RETURNING * INTO t;
  IF t.id IS NULL THEN RETURN 0; END IF;
  UPDATE public.tenants SET call_minutes_balance = call_minutes_balance + t.minutes WHERE id = t.tenant_id;
  RETURN t.minutes;
END $$;
REVOKE ALL ON FUNCTION public.add_call_minutes_for_topup(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_call_minutes_for_topup(text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_adjust_sms_credits(_tenant_id uuid, _delta integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cur int; nxt int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'Only platform super-admins can change SMS credits'; END IF;
  IF _delta IS NULL OR _delta = 0 OR abs(_delta) > 1000000 THEN RAISE EXCEPTION 'Enter a valid number of texts'; END IF;
  SELECT COALESCE(sms_credit_balance,0) INTO cur FROM public.tenants WHERE id = _tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Church not found'; END IF;
  nxt := GREATEST(0, cur + _delta);
  UPDATE public.tenants SET sms_credit_balance = nxt WHERE id = _tenant_id;
  INSERT INTO public.sms_credit_ledger(tenant_id, delta, reason) VALUES (_tenant_id, nxt - cur, 'admin_adjust');
  RETURN nxt;
END $$;
REVOKE ALL ON FUNCTION public.admin_adjust_sms_credits(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_sms_credits(uuid, integer) TO authenticated, service_role;