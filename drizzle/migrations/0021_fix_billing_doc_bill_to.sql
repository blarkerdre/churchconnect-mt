CREATE OR REPLACE FUNCTION public._create_billing_doc(_tenant uuid, _type text, _source text, _payment uuid, _topup uuid, _sub uuid, _currency text, _items jsonb, _total numeric, _notes text, _status text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _id uuid; _name text; _num text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('inv:'||_tenant::text||_type));
  SELECT name INTO _name FROM public.tenants WHERE id=_tenant;
  _num := public.next_invoice_number(_tenant, _type);
  INSERT INTO public.tenant_invoices(tenant_id, subscription_id, payment_id, sms_topup_id, source, document_type, invoice_number, status, issue_date, due_date, currency, subtotal, total, line_items, bill_to, notes)
  VALUES (_tenant, _sub, _payment, _topup, _source, _type, _num, _status, CURRENT_DATE, CASE WHEN _type='invoice' THEN CURRENT_DATE + 14 END, COALESCE(_currency,'GBP'), _total, _total, _items, jsonb_build_object('name', _name), _notes)
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public._create_billing_doc(uuid,text,text,uuid,uuid,uuid,text,jsonb,numeric,text,text) FROM PUBLIC, anon, authenticated;