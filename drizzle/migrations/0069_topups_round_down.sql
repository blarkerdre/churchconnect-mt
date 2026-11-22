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
  VALUES (_tenant_id, _quantity, price, trunc(price*_quantity,2), cur, 'awaiting_transfer', 'bank_transfer', auth.uid(),
    'SMS-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)))
  RETURNING * INTO r;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.request_call_bank_topup(_tenant_id uuid, _minutes integer)
RETURNS public.call_minute_topups LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE price numeric; cur text; r public.call_minute_topups;
BEGIN
  IF NOT (public.has_role(auth.uid(),'super_admin') OR EXISTS (SELECT 1 FROM public.tenant_memberships WHERE tenant_id=_tenant_id AND user_id=auth.uid() AND role IN ('owner','admin'))) THEN
    RAISE EXCEPTION 'Only church owners or admins can buy call minutes'; END IF;
  IF _minutes < 10 OR _minutes > 100000 THEN RAISE EXCEPTION 'Choose between 10 and 100,000 minutes'; END IF;
  price := public.call_minute_price_for_tenant(_tenant_id);
  IF price IS NULL OR price <= 0 THEN RAISE EXCEPTION 'No call minute price is set for this church'; END IF;
  SELECT COALESCE(billing_currency,'GBP') INTO cur FROM public.tenants WHERE id=_tenant_id;
  INSERT INTO public.call_minute_topups(tenant_id, minutes, unit_price, amount, currency, status, method, created_by, reference)
  VALUES (_tenant_id, _minutes, price, trunc(price*_minutes,2), cur, 'awaiting_transfer', 'bank_transfer', auth.uid(),
    'CALL-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))) RETURNING * INTO r;
  RETURN r;
END $$;