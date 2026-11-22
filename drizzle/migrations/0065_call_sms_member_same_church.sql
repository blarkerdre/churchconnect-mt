CREATE OR REPLACE FUNCTION public.enforce_log_member_same_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _mid uuid;
BEGIN
  IF TG_TABLE_NAME = 'call_log' THEN
    _mid := NEW.member_id;
  ELSE
    _mid := NEW.recipient_member_id;
  END IF;
  IF _mid IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.members m WHERE m.id = _mid AND m.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'Member does not belong to this church' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.enforce_log_member_same_tenant() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_call_log_member_same_tenant ON public.call_log;
CREATE TRIGGER trg_call_log_member_same_tenant
BEFORE INSERT OR UPDATE OF member_id, tenant_id ON public.call_log
FOR EACH ROW EXECUTE FUNCTION public.enforce_log_member_same_tenant();

DROP TRIGGER IF EXISTS trg_sms_log_member_same_tenant ON public.sms_log;
CREATE TRIGGER trg_sms_log_member_same_tenant
BEFORE INSERT OR UPDATE OF recipient_member_id, tenant_id ON public.sms_log
FOR EACH ROW EXECUTE FUNCTION public.enforce_log_member_same_tenant();