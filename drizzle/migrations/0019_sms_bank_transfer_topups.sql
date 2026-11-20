ALTER TABLE public.sms_topups ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'card';
ALTER TABLE public.sms_topups ADD COLUMN IF NOT EXISTS reference text;
ALTER TABLE public.sms_topups ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.sms_topups ADD COLUMN IF NOT EXISTS confirmed_by uuid;

CREATE OR REPLACE FUNCTION public.sms_unit_price_for_tenant(_tenant_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(t.sms_unit_price_override,
    CASE WHEN upper(COALESCE(p.currency,'GBP')) = upper(COALESCE(t.billing_currency,'GBP')) THEN p.overage_price_sms END, 0)
  FROM public.tenants t LEFT JOIN public.pricing_plans p ON p.id = t.pricing_plan_id WHERE t.id = _tenant_id
$$;
REVOKE ALL ON FUNCTION public.sms_unit_price_for_tenant(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.request_sms_bank_topup(_tenant_id uuid, _quantity integer)
RETURNS public.sms_topups LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE price numeric; cur text; r public.sms_topups;
BEGIN
  IF NOT (public.has_role(auth.uid(),'super_admin') OR EXISTS (SELECT 1 FROM public.tenant_memberships WHERE tenant_id=_tenant_id AND user_id=auth.uid() AND role IN ('owner','admin'))) THEN
    RAISE EXCEPTION 'Only church owners or admins can buy texts';
  END IF;
  IF _quantity < 10 OR _quantity > 100000 THEN RAISE EXCEPTION 'Choose between 10 and 100,000 texts'; END IF;
  price := public.sms_unit_price_for_tenant(_tenant_id);
  IF price IS NULL OR price <= 0 THEN RAISE EXCEPTION 'No SMS price is set for this church'; END IF;
  SELECT COALESCE(billing_currency,'GBP') INTO cur FROM public.tenants WHERE id=_tenant_id;
  INSERT INTO public.sms_topups(tenant_id, quantity, unit_price, amount, currency, status, method, created_by, reference)
  VALUES (_tenant_id, _quantity, price, round(price*_quantity,2), cur, 'awaiting_transfer', 'bank_transfer', auth.uid(),
    'SMS-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)))
  RETURNING * INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.request_sms_bank_topup(uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_sms_bank_topup(uuid,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_sms_bank_topup(_topup_id uuid, _notes text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.sms_topups;
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'Only super admins can confirm payments'; END IF;
  UPDATE public.sms_topups SET status='paid', paid_at=now(), confirmed_by=auth.uid(), notes=COALESCE(_notes, notes)
  WHERE id=_topup_id AND status='awaiting_transfer' RETURNING * INTO t;
  IF t.id IS NULL THEN RETURN 0; END IF;
  UPDATE public.tenants SET sms_credit_balance = sms_credit_balance + t.quantity WHERE id=t.tenant_id;
  INSERT INTO public.sms_credit_ledger(tenant_id, delta, reason) VALUES (t.tenant_id, t.quantity, 'topup_bank_transfer');
  RETURN t.quantity;
END $$;
REVOKE ALL ON FUNCTION public.confirm_sms_bank_topup(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_sms_bank_topup(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_sms_bank_topup(_topup_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tid uuid;
BEGIN
  SELECT tenant_id INTO tid FROM public.sms_topups WHERE id=_topup_id AND status='awaiting_transfer';
  IF tid IS NULL THEN RETURN; END IF;
  IF NOT (public.has_role(auth.uid(),'super_admin') OR EXISTS (SELECT 1 FROM public.tenant_memberships WHERE tenant_id=tid AND user_id=auth.uid() AND role IN ('owner','admin'))) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  UPDATE public.sms_topups SET status='cancelled' WHERE id=_topup_id AND status='awaiting_transfer';
END $$;
REVOKE ALL ON FUNCTION public.cancel_sms_bank_topup(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_sms_bank_topup(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_billing_bank_details()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT value->>'text' FROM public.app_settings WHERE key='billing_bank_details' AND tenant_id IS NULL LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_billing_bank_details() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_billing_bank_details() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_billing_bank_details(_text text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'Only super admins'; END IF;
  UPDATE public.app_settings SET value=jsonb_build_object('text', left(_text,2000)), updated_by=auth.uid(), updated_at=now()
  WHERE key='billing_bank_details' AND tenant_id IS NULL;
  IF NOT FOUND THEN
    INSERT INTO public.app_settings(key, value, updated_by, tenant_id) VALUES ('billing_bank_details', jsonb_build_object('text', left(_text,2000)), auth.uid(), NULL);
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_billing_bank_details(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_billing_bank_details(text) TO authenticated;