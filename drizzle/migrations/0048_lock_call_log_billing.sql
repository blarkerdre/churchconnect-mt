-- Call records are only written by the server (make-call / provider webhook).
DROP POLICY IF EXISTS "Authenticated users can insert call logs" ON public.call_log;
REVOKE INSERT, UPDATE, DELETE ON public.call_log FROM authenticated, anon;

-- Billable minutes are always derived from the call length; supplied values are ignored
-- and minutes already billed are never changed or billed twice.
CREATE OR REPLACE FUNCTION public.call_log_meter_minutes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _billable int; _used int; _limit int; _over int;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.billable_minutes IS NOT NULL THEN
    NEW.billable_minutes := OLD.billable_minutes;
    RETURN NEW;
  END IF;
  NEW.billable_minutes := NULL;
  IF NEW.duration_seconds IS NULL OR NEW.duration_seconds <= 0 THEN
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
END $function$;

DROP TRIGGER IF EXISTS trg_call_log_meter_minutes ON public.call_log;
CREATE TRIGGER trg_call_log_meter_minutes
  BEFORE INSERT OR UPDATE OF duration_seconds, billable_minutes ON public.call_log
  FOR EACH ROW EXECUTE FUNCTION public.call_log_meter_minutes();