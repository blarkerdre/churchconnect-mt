CREATE OR REPLACE FUNCTION public.email_send_log_inherit_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL AND NEW.message_id IS NOT NULL THEN
    SELECT l.tenant_id INTO NEW.tenant_id
    FROM public.email_send_log l
    WHERE l.message_id = NEW.message_id
      AND l.tenant_id IS NOT NULL
    ORDER BY l.created_at DESC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_send_log_inherit_tenant ON public.email_send_log;
CREATE TRIGGER trg_email_send_log_inherit_tenant
BEFORE INSERT ON public.email_send_log
FOR EACH ROW EXECUTE FUNCTION public.email_send_log_inherit_tenant();

UPDATE public.email_send_log t
SET tenant_id = p.tenant_id
FROM public.email_send_log p
WHERE t.tenant_id IS NULL
  AND t.message_id IS NOT NULL
  AND p.message_id = t.message_id
  AND p.tenant_id IS NOT NULL;