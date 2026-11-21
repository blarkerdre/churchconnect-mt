CREATE OR REPLACE FUNCTION public.tenants_guard_call_billing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated','anon') AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.call_minutes_limit_monthly := 0; NEW.call_minutes_balance := 0; NEW.call_minute_price_override := NULL;
      NEW.sms_credit_balance := 0; NEW.sms_unit_price_override := NULL; NEW.sms_cycle_start := NULL;
    ELSIF NEW.call_minutes_limit_monthly IS DISTINCT FROM OLD.call_minutes_limit_monthly
       OR NEW.call_minutes_balance IS DISTINCT FROM OLD.call_minutes_balance
       OR NEW.call_minute_price_override IS DISTINCT FROM OLD.call_minute_price_override THEN
      RAISE EXCEPTION 'Only platform super-admins can change call minute billing';
    ELSIF NEW.sms_limit_monthly IS DISTINCT FROM OLD.sms_limit_monthly
       OR NEW.whatsapp_limit_monthly IS DISTINCT FROM OLD.whatsapp_limit_monthly
       OR NEW.sms_credit_balance IS DISTINCT FROM OLD.sms_credit_balance
       OR NEW.sms_unit_price_override IS DISTINCT FROM OLD.sms_unit_price_override
       OR NEW.sms_cycle_start IS DISTINCT FROM OLD.sms_cycle_start THEN
      RAISE EXCEPTION 'Only platform super-admins can change SMS limits, balance or pricing';
    END IF;
  END IF;
  RETURN NEW;
END $$;