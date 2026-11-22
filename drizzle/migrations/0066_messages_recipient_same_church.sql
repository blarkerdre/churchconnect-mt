CREATE OR REPLACE FUNCTION public.enforce_message_recipient_same_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'Messages must belong to a church' USING ERRCODE = '42501';
  END IF;
  IF NEW.recipient_id IS NOT NULL AND NOT public.person_in_tenant(NEW.recipient_id, NEW.tenant_id) THEN
    RAISE EXCEPTION 'That person is not in this church' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.enforce_message_recipient_same_tenant() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_messages_recipient_same_tenant ON public.messages;
CREATE TRIGGER trg_messages_recipient_same_tenant
BEFORE INSERT OR UPDATE OF recipient_id, tenant_id ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_message_recipient_same_tenant();