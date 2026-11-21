ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS sms_cycle_start timestamptz;

CREATE OR REPLACE FUNCTION public.reset_sms_cycle_on_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
    UPDATE public.tenants SET sms_cycle_start = now() WHERE id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_reset_sms_cycle_on_payment ON public.tenant_payments;
CREATE TRIGGER trg_reset_sms_cycle_on_payment AFTER INSERT OR UPDATE OF status ON public.tenant_payments
FOR EACH ROW EXECUTE FUNCTION public.reset_sms_cycle_on_payment();

-- Start date of the church's current text allowance period
CREATE OR REPLACE FUNCTION public.sms_cycle_start_for(_tenant_id uuid)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(sms_cycle_start, date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
  FROM public.tenants WHERE id = _tenant_id
$$;
REVOKE EXECUTE ON FUNCTION public.reset_sms_cycle_on_payment() FROM PUBLIC, anon, authenticated;