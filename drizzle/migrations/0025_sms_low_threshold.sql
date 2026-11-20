ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS sms_low_threshold integer NOT NULL DEFAULT 20 CHECK (sms_low_threshold >= 0);

CREATE OR REPLACE FUNCTION public.notify_sms_low()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; used int; avail int; mstart timestamptz := date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
BEGIN
  IF NEW.tenant_id IS NULL OR coalesce(NEW.channel,'sms') <> 'sms' OR NEW.status = 'failed' THEN RETURN NEW; END IF;
  SELECT sms_limit_monthly, coalesce(sms_credit_balance,0) bal, sms_low_threshold INTO t FROM tenants WHERE id = NEW.tenant_id;
  IF t IS NULL OR coalesce(t.sms_limit_monthly,0) <= 0 OR t.sms_low_threshold <= 0 THEN RETURN NEW; END IF;
  SELECT count(*) INTO used FROM sms_log WHERE tenant_id = NEW.tenant_id AND coalesce(channel,'sms')='sms' AND status IS DISTINCT FROM 'failed' AND created_at >= mstart;
  avail := greatest(0, t.sms_limit_monthly - used) + t.bal;
  IF avail > t.sms_low_threshold THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM notifications WHERE tenant_id = NEW.tenant_id AND type = 'sms_low' AND created_at >= mstart) THEN RETURN NEW; END IF;
  INSERT INTO notifications (user_id, tenant_id, title, message, type, reference_type)
  SELECT m.user_id, NEW.tenant_id, 'Texts running low',
         CASE WHEN avail = 0 THEN 'You have run out of texts. Top up in Settings → Billing to keep sending.'
              ELSE 'Only ' || avail || ' texts left. Top up in Settings → Billing.' END,
         'sms_low', 'sms'
  FROM tenant_memberships m WHERE m.tenant_id = NEW.tenant_id AND m.role IN ('owner','admin');
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_sms_low() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_sms_low ON public.sms_log;
CREATE TRIGGER trg_notify_sms_low AFTER INSERT ON public.sms_log FOR EACH ROW EXECUTE FUNCTION public.notify_sms_low();