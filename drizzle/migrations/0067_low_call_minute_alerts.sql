ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS call_low_alert_settings jsonb NOT NULL DEFAULT '{"enabled":true,"threshold":30,"channels":["in_app","email"],"recipients":["owner","admin"],"template":""}'::jsonb,
  ADD COLUMN IF NOT EXISTS call_low_alert_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS call_empty_alert_sent_at timestamptz;

CREATE TABLE public.call_minute_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kind text NOT NULL,
  minutes_left integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);
GRANT SELECT ON public.call_minute_alerts TO authenticated;
GRANT ALL ON public.call_minute_alerts TO service_role;
ALTER TABLE public.call_minute_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Church admins read own call alerts" ON public.call_minute_alerts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = call_minute_alerts.tenant_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')));
CREATE INDEX call_minute_alerts_pending ON public.call_minute_alerts(tenant_id) WHERE delivered_at IS NULL;

CREATE OR REPLACE FUNCTION public.tenants_guard_call_alerts()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE s jsonb := COALESCE(NEW.call_low_alert_settings, '{}'::jsonb); thr int; tmpl text;
BEGIN
  IF current_user IN ('authenticated','anon') THEN
    NEW.call_low_alert_sent_at := OLD.call_low_alert_sent_at;
    NEW.call_empty_alert_sent_at := OLD.call_empty_alert_sent_at;
  END IF;
  IF NEW.call_low_alert_settings IS DISTINCT FROM OLD.call_low_alert_settings THEN
    BEGIN thr := (s->>'threshold')::int; EXCEPTION WHEN others THEN thr := NULL; END;
    IF thr IS NULL OR thr < 1 OR thr > 10000 THEN RAISE EXCEPTION 'Alert level must be between 1 and 10000 minutes'; END IF;
    tmpl := COALESCE(s->>'template','');
    IF length(tmpl) > 300 THEN RAISE EXCEPTION 'Alert message must be 300 characters or fewer'; END IF;
    IF tmpl ~ '[<>]' THEN RAISE EXCEPTION 'Alert message must be plain text'; END IF;
    NEW.call_low_alert_settings := jsonb_build_object(
      'enabled', COALESCE((s->>'enabled')::boolean, true),
      'threshold', thr,
      'channels', COALESCE((SELECT jsonb_agg(DISTINCT c) FROM jsonb_array_elements_text(COALESCE(s->'channels','[]'::jsonb)) c WHERE c IN ('in_app','email','sms')), '[]'::jsonb),
      'recipients', COALESCE((SELECT jsonb_agg(DISTINCT r) FROM jsonb_array_elements_text(COALESCE(s->'recipients','[]'::jsonb)) r WHERE r IN ('owner','admin')), '["owner"]'::jsonb),
      'template', tmpl);
    NEW.call_low_alert_sent_at := NULL;
  END IF;
  IF COALESCE(NEW.call_minutes_balance,0) > COALESCE(OLD.call_minutes_balance,0) THEN
    NEW.call_low_alert_sent_at := NULL;
    NEW.call_empty_alert_sent_at := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tenants_guard_call_alerts ON public.tenants;
CREATE TRIGGER tenants_guard_call_alerts BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.tenants_guard_call_alerts();

CREATE OR REPLACE FUNCTION public.call_log_meter_minutes()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _billable int; _used int; _limit int; _over int; _bal int; _left int; _cycle timestamptz;
  _s jsonb; _low timestamptz; _empty timestamptz; _kind text;
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
  SELECT call_minutes_limit_monthly, call_low_alert_settings, call_low_alert_sent_at, call_empty_alert_sent_at
    INTO _limit, _s, _low, _empty FROM public.tenants WHERE id = NEW.tenant_id FOR UPDATE;
  _cycle := public.call_cycle_start(NEW.tenant_id);
  SELECT COALESCE(sum(billable_minutes),0) INTO _used FROM public.call_log
    WHERE tenant_id = NEW.tenant_id AND id <> NEW.id AND created_at >= _cycle;
  NEW.billable_minutes := _billable;
  IF COALESCE(_limit,0) > 0 THEN
    _over := GREATEST(0, _used + _billable - GREATEST(_limit, _used));
    IF _over > 0 THEN
      UPDATE public.tenants SET call_minutes_balance = GREATEST(0, call_minutes_balance - _over) WHERE id = NEW.tenant_id;
    END IF;
    SELECT COALESCE(call_minutes_balance,0) INTO _bal FROM public.tenants WHERE id = NEW.tenant_id;
    _left := GREATEST(0, _limit - (_used + _billable)) + _bal;
    IF COALESCE((_s->>'enabled')::boolean, true) THEN
      IF _left <= 0 AND (_empty IS NULL OR _empty < _cycle) THEN _kind := 'empty';
      ELSIF _left > 0 AND _left <= COALESCE((_s->>'threshold')::int, 30) AND (_low IS NULL OR _low < _cycle) THEN _kind := 'low';
      END IF;
    END IF;
    IF _kind = 'empty' THEN
      UPDATE public.tenants SET call_empty_alert_sent_at = now(), call_low_alert_sent_at = COALESCE(call_low_alert_sent_at, now()) WHERE id = NEW.tenant_id;
    ELSIF _kind = 'low' THEN
      UPDATE public.tenants SET call_low_alert_sent_at = now() WHERE id = NEW.tenant_id;
    END IF;
    IF _kind IS NOT NULL THEN
      INSERT INTO public.call_minute_alerts(tenant_id, kind, minutes_left) VALUES (NEW.tenant_id, _kind, _left);
    END IF;
  END IF;
  RETURN NEW;
END $function$;