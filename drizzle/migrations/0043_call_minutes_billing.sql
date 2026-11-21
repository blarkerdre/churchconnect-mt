ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS call_minutes_limit_monthly integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS call_minutes_balance integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS call_minute_price_override numeric;
ALTER TABLE public.pricing_plans
  ADD COLUMN IF NOT EXISTS included_call_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overage_price_call_minute numeric NOT NULL DEFAULT 0;
ALTER TABLE public.call_log ADD COLUMN IF NOT EXISTS billable_minutes integer;

CREATE OR REPLACE FUNCTION public.tenants_guard_call_billing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated','anon') AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.call_minutes_limit_monthly := 0; NEW.call_minutes_balance := 0; NEW.call_minute_price_override := NULL;
    ELSIF NEW.call_minutes_limit_monthly IS DISTINCT FROM OLD.call_minutes_limit_monthly
       OR NEW.call_minutes_balance IS DISTINCT FROM OLD.call_minutes_balance
       OR NEW.call_minute_price_override IS DISTINCT FROM OLD.call_minute_price_override THEN
      RAISE EXCEPTION 'Only platform super-admins can change call minute billing';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_tenants_guard_call_billing ON public.tenants;
CREATE TRIGGER trg_tenants_guard_call_billing BEFORE INSERT OR UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.tenants_guard_call_billing();

CREATE OR REPLACE FUNCTION public.call_cycle_start(_tenant_id uuid)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT CASE WHEN t.sms_cycle_start IS NOT NULL AND t.sms_cycle_start > now() - interval '31 days'
                 THEN t.sms_cycle_start::timestamptz END FROM public.tenants t WHERE t.id = _tenant_id),
    date_trunc('month', now()));
$$;

CREATE OR REPLACE FUNCTION public.call_minutes_used(_tenant_id uuid)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated','anon') AND NOT (
       public.has_role(auth.uid(), 'super_admin') OR public.user_has_tenant_access(auth.uid(), _tenant_id)) THEN
    RETURN 0;
  END IF;
  RETURN COALESCE((SELECT sum(billable_minutes) FROM public.call_log
    WHERE tenant_id = _tenant_id AND created_at >= public.call_cycle_start(_tenant_id)), 0)::int;
END $$;
REVOKE ALL ON FUNCTION public.call_minutes_used(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.call_minutes_used(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.call_log_meter_minutes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _billable int; _used int; _limit int; _over int;
BEGIN
  IF NEW.duration_seconds IS NULL OR NEW.duration_seconds <= 0 OR NEW.billable_minutes IS NOT NULL THEN
    RETURN NEW;
  END IF;
  _billable := ceil(NEW.duration_seconds / 60.0)::int;
  SELECT call_minutes_limit_monthly INTO _limit FROM public.tenants WHERE id = NEW.tenant_id FOR UPDATE;
  SELECT COALESCE(sum(billable_minutes),0) INTO _used FROM public.call_log
    WHERE tenant_id = NEW.tenant_id AND id <> NEW.id AND created_at >= public.call_cycle_start(NEW.tenant_id);
  NEW.billable_minutes := _billable;
  IF COALESCE(_limit,0) > 0 THEN
    _over := GREATEST(0, _used + _billable - GREATEST(_limit, _used));
    IF _over > 0 THEN
      UPDATE public.tenants SET call_minutes_balance = GREATEST(0, call_minutes_balance - _over) WHERE id = NEW.tenant_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_call_log_meter_minutes ON public.call_log;
CREATE TRIGGER trg_call_log_meter_minutes BEFORE INSERT OR UPDATE OF duration_seconds ON public.call_log
  FOR EACH ROW EXECUTE FUNCTION public.call_log_meter_minutes();