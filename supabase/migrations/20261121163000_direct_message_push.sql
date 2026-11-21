-- Applied directly: direct messages create a bell notification (which triggers web push).
CREATE OR REPLACE FUNCTION public.notify_new_direct_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _name text;
BEGIN
  IF NEW.recipient_id IS NULL OR NEW.recipient_id = NEW.sender_id OR NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT nullif(trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')), '') INTO _name
    FROM members WHERE user_id = NEW.sender_id AND tenant_id = NEW.tenant_id LIMIT 1;
  INSERT INTO notifications (user_id, tenant_id, title, message, type, reference_type, reference_id)
  VALUES (NEW.recipient_id, NEW.tenant_id,
          'New message from ' || coalesce(_name, 'someone'),
          left(regexp_replace(coalesce(CASE WHEN NEW.subject IS NOT NULL AND NEW.subject <> '' THEN NEW.subject || ' - ' ELSE '' END || NEW.content, ''), '\s+', ' ', 'g'), 120),
          'message', 'message', NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_new_direct_message() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_notify_new_direct_message ON public.messages;
CREATE TRIGGER trg_notify_new_direct_message AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_direct_message();
