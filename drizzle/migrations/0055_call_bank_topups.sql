ALTER TABLE public.call_minute_topups ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'card', ADD COLUMN IF NOT EXISTS reference text, ADD COLUMN IF NOT EXISTS confirmed_by uuid;
CREATE UNIQUE INDEX IF NOT EXISTS call_minute_topups_reference_key ON public.call_minute_topups(reference) WHERE reference IS NOT NULL;

CREATE OR REPLACE FUNCTION public.call_minute_price_for_tenant(_tenant_id uuid) RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE(t.call_minute_price_override,
    CASE WHEN upper(COALESCE(p.currency,'GBP')) = upper(COALESCE(t.billing_currency,'GBP')) THEN p.overage_price_call_minute END, 0)
  FROM public.tenants t LEFT JOIN public.pricing_plans p ON p.id = t.pricing_plan_id WHERE t.id = _tenant_id $$;
REVOKE EXECUTE ON FUNCTION public.call_minute_price_for_tenant(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.request_call_bank_topup(_tenant_id uuid, _minutes integer) RETURNS public.call_minute_topups LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE price numeric; cur text; r public.call_minute_topups;
BEGIN
  IF NOT (public.has_role(auth.uid(),'super_admin') OR EXISTS (SELECT 1 FROM public.tenant_memberships WHERE tenant_id=_tenant_id AND user_id=auth.uid() AND role IN ('owner','admin'))) THEN
    RAISE EXCEPTION 'Only church owners or admins can buy call minutes'; END IF;
  IF _minutes < 10 OR _minutes > 100000 THEN RAISE EXCEPTION 'Choose between 10 and 100,000 minutes'; END IF;
  price := public.call_minute_price_for_tenant(_tenant_id);
  IF price IS NULL OR price <= 0 THEN RAISE EXCEPTION 'No call minute price is set for this church'; END IF;
  SELECT COALESCE(billing_currency,'GBP') INTO cur FROM public.tenants WHERE id=_tenant_id;
  INSERT INTO public.call_minute_topups(tenant_id, minutes, unit_price, amount, currency, status, method, created_by, reference)
  VALUES (_tenant_id, _minutes, price, round(price*_minutes,2), cur, 'awaiting_transfer', 'bank_transfer', auth.uid(),
    'CALL-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))) RETURNING * INTO r;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.confirm_call_bank_topup(_topup_id uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.call_minute_topups;
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'Only super admins can confirm payments'; END IF;
  UPDATE public.call_minute_topups SET status='paid', paid_at=now(), confirmed_by=auth.uid()
    WHERE id=_topup_id AND status='awaiting_transfer' RETURNING * INTO t;
  IF t.id IS NULL THEN RETURN 0; END IF;
  UPDATE public.tenants SET call_minutes_balance = call_minutes_balance + t.minutes WHERE id=t.tenant_id;
  RETURN t.minutes;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_call_bank_topup(_topup_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE tid uuid;
BEGIN
  SELECT tenant_id INTO tid FROM public.call_minute_topups WHERE id=_topup_id AND status='awaiting_transfer';
  IF tid IS NULL THEN RETURN; END IF;
  IF NOT (public.has_role(auth.uid(),'super_admin') OR EXISTS (SELECT 1 FROM public.tenant_memberships WHERE tenant_id=tid AND user_id=auth.uid() AND role IN ('owner','admin'))) THEN
    RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE public.call_minute_topups SET status='cancelled' WHERE id=_topup_id AND status='awaiting_transfer';
END $$;
REVOKE EXECUTE ON FUNCTION public.request_call_bank_topup(uuid,integer), public.confirm_call_bank_topup(uuid), public.cancel_call_bank_topup(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_call_bank_topup(uuid,integer), public.confirm_call_bank_topup(uuid), public.cancel_call_bank_topup(uuid) TO authenticated;