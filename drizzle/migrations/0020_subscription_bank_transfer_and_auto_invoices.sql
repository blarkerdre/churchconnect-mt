ALTER TABLE public.tenant_invoices ADD COLUMN IF NOT EXISTS source text, ADD COLUMN IF NOT EXISTS sms_topup_id uuid REFERENCES public.sms_topups(id) ON DELETE SET NULL;
ALTER TABLE public.tenant_payments ADD COLUMN IF NOT EXISTS includes_setup_fee boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS confirmed_by uuid;

DROP POLICY IF EXISTS "Tenant owners can insert payments" ON public.tenant_payments;

CREATE OR REPLACE FUNCTION public._create_billing_doc(_tenant uuid, _type text, _source text, _payment uuid, _topup uuid, _sub uuid, _currency text, _items jsonb, _total numeric, _notes text, _status text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _id uuid; _t record; _num text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('inv:'||_tenant::text||_type));
  SELECT name, contact_email INTO _t FROM public.tenants WHERE id=_tenant;
  _num := public.next_invoice_number(_tenant, _type);
  INSERT INTO public.tenant_invoices(tenant_id, subscription_id, payment_id, sms_topup_id, source, document_type, invoice_number, status, issue_date, due_date, currency, subtotal, total, line_items, bill_to, notes)
  VALUES (_tenant, _sub, _payment, _topup, _source, _type, _num, _status, CURRENT_DATE, CASE WHEN _type='invoice' THEN CURRENT_DATE + 14 END, COALESCE(_currency,'GBP'), _total, _total, _items, jsonb_build_object('name', _t.name, 'email', _t.contact_email), _notes)
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public._create_billing_doc(uuid,text,text,uuid,uuid,uuid,text,jsonb,numeric,text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.billing_docs_for_sms_topup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _items jsonb;
BEGIN
  _items := jsonb_build_array(jsonb_build_object('description', 'SMS top-up ('||NEW.quantity||' texts)', 'quantity', 1, 'amount', NEW.amount));
  IF TG_OP='INSERT' AND NEW.status='awaiting_transfer' THEN
    PERFORM public._create_billing_doc(NEW.tenant_id,'invoice','sms',NULL,NEW.id,NULL,NEW.currency,_items,NEW.amount,'Bank transfer reference: '||COALESCE(NEW.reference,''),'sent');
  END IF;
  IF NEW.status='paid' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'paid')
     AND NOT EXISTS (SELECT 1 FROM public.tenant_invoices WHERE sms_topup_id=NEW.id AND document_type='receipt') THEN
    UPDATE public.tenant_invoices SET status='paid', updated_at=now() WHERE sms_topup_id=NEW.id AND document_type='invoice';
    PERFORM public._create_billing_doc(NEW.tenant_id,'receipt','sms',NULL,NEW.id,NULL,NEW.currency,_items,NEW.amount,'Paid by '||CASE WHEN NEW.method='bank_transfer' THEN 'bank transfer' ELSE 'card' END||COALESCE(' (ref '||NEW.reference||')',''),'paid');
  END IF;
  IF NEW.status='cancelled' AND TG_OP='UPDATE' THEN
    UPDATE public.tenant_invoices SET status='void', updated_at=now() WHERE sms_topup_id=NEW.id AND document_type='invoice';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_billing_docs_sms_topup ON public.sms_topups;
CREATE TRIGGER trg_billing_docs_sms_topup AFTER INSERT OR UPDATE OF status ON public.sms_topups FOR EACH ROW EXECUTE FUNCTION public.billing_docs_for_sms_topup();

CREATE OR REPLACE FUNCTION public.billing_docs_for_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _items jsonb; _sub record;
BEGIN
  SELECT * INTO _sub FROM public.tenant_subscriptions WHERE id=NEW.subscription_id;
  IF NEW.includes_setup_fee AND _sub.id IS NOT NULL THEN
    _items := jsonb_build_array(
      jsonb_build_object('description','Subscription ('||COALESCE(_sub.billing_cycle,'monthly')||')','quantity',1,'amount',NEW.amount - COALESCE(_sub.setup_fee_amount,0)),
      jsonb_build_object('description','One-time setup fee','quantity',1,'amount',COALESCE(_sub.setup_fee_amount,0)));
  ELSE
    _items := jsonb_build_array(jsonb_build_object('description','Subscription'||COALESCE(' ('||_sub.billing_cycle||')',''),'quantity',1,'amount',NEW.amount));
  END IF;
  IF TG_OP='INSERT' AND NEW.status='awaiting_transfer' THEN
    PERFORM public._create_billing_doc(NEW.tenant_id,'invoice','subscription',NEW.id,NULL,NEW.subscription_id,NEW.currency,_items,NEW.amount,'Bank transfer reference: '||COALESCE(NEW.reference,''),'sent');
  END IF;
  IF NEW.status='completed' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'completed')
     AND NOT EXISTS (SELECT 1 FROM public.tenant_invoices WHERE payment_id=NEW.id AND document_type='receipt') THEN
    UPDATE public.tenant_invoices SET status='paid', updated_at=now() WHERE payment_id=NEW.id AND document_type='invoice';
    PERFORM public._create_billing_doc(NEW.tenant_id,'receipt','subscription',NEW.id,NULL,NEW.subscription_id,NEW.currency,_items,NEW.amount,'Paid by '||COALESCE(replace(NEW.payment_method,'_',' '),'payment')||COALESCE(' (ref '||NEW.reference||')',''),'paid');
  END IF;
  IF NEW.status='cancelled' AND TG_OP='UPDATE' THEN
    UPDATE public.tenant_invoices SET status='void', updated_at=now() WHERE payment_id=NEW.id AND document_type='invoice';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_billing_docs_payment ON public.tenant_payments;
CREATE TRIGGER trg_billing_docs_payment AFTER INSERT OR UPDATE OF status ON public.tenant_payments FOR EACH ROW EXECUTE FUNCTION public.billing_docs_for_payment();

CREATE OR REPLACE FUNCTION public.request_subscription_bank_payment(_tenant_id uuid)
RETURNS public.tenant_payments LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _sub public.tenant_subscriptions; _p public.tenant_payments; _amt numeric; _setup boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_tenant_admin(auth.uid(), _tenant_id) OR public.has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'Only church owners and admins can request this'; END IF;
  SELECT * INTO _sub FROM public.tenant_subscriptions WHERE tenant_id=_tenant_id AND is_active LIMIT 1;
  IF _sub.id IS NULL OR COALESCE(_sub.amount,0) <= 0 THEN RAISE EXCEPTION 'No subscription price is set for this church'; END IF;
  IF _sub.stripe_subscription_id IS NOT NULL THEN RAISE EXCEPTION 'This church already pays automatically by card'; END IF;
  IF EXISTS (SELECT 1 FROM public.tenant_payments WHERE tenant_id=_tenant_id AND status='awaiting_transfer') THEN
    RAISE EXCEPTION 'A bank transfer is already waiting to be confirmed'; END IF;
  _setup := COALESCE(_sub.setup_fee_amount,0) > 0 AND NOT COALESCE(_sub.setup_fee_paid,false);
  _amt := _sub.amount + CASE WHEN _setup THEN _sub.setup_fee_amount ELSE 0 END;
  INSERT INTO public.tenant_payments(tenant_id, subscription_id, amount, currency, payment_method, reference, status, recorded_by, includes_setup_fee)
  VALUES (_tenant_id, _sub.id, _amt, _sub.currency, 'bank_transfer', 'SUB-'||upper(substr(md5(gen_random_uuid()::text),1,8)), 'awaiting_transfer', auth.uid(), _setup)
  RETURNING * INTO _p;
  RETURN _p;
END $$;

CREATE OR REPLACE FUNCTION public.confirm_subscription_bank_payment(_payment_id uuid, _notes text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _p public.tenant_payments; _sub public.tenant_subscriptions;
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'Only super admins can confirm payments'; END IF;
  UPDATE public.tenant_payments SET status='completed', payment_date=CURRENT_DATE, confirmed_by=auth.uid(), notes=COALESCE(_notes, notes)
  WHERE id=_payment_id AND status='awaiting_transfer' RETURNING * INTO _p;
  IF _p.id IS NULL THEN RETURN false; END IF;
  SELECT * INTO _sub FROM public.tenant_subscriptions WHERE id=_p.subscription_id;
  IF _sub.id IS NOT NULL THEN
    UPDATE public.tenant_subscriptions SET
      next_due_date = CASE WHEN billing_cycle='yearly' THEN COALESCE(next_due_date,CURRENT_DATE) + interval '1 year' ELSE COALESCE(next_due_date,CURRENT_DATE) + interval '1 month' END,
      setup_fee_paid = setup_fee_paid OR _p.includes_setup_fee,
      setup_fee_paid_at = CASE WHEN _p.includes_setup_fee AND NOT setup_fee_paid THEN now() ELSE setup_fee_paid_at END,
      updated_at = now()
    WHERE id=_sub.id;
  END IF;
  UPDATE public.tenants SET subscription_status='active' WHERE id=_p.tenant_id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_subscription_bank_payment(_payment_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _tid uuid;
BEGIN
  SELECT tenant_id INTO _tid FROM public.tenant_payments WHERE id=_payment_id AND status='awaiting_transfer';
  IF _tid IS NULL THEN RETURN false; END IF;
  IF NOT (public.is_tenant_admin(auth.uid(), _tid) OR public.has_role(auth.uid(),'super_admin')) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE public.tenant_payments SET status='cancelled' WHERE id=_payment_id;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.request_subscription_bank_payment(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_subscription_bank_payment(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_subscription_bank_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_subscription_bank_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_subscription_bank_payment(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_subscription_bank_payment(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.billing_docs_for_payment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.billing_docs_for_sms_topup() FROM PUBLIC, anon, authenticated;