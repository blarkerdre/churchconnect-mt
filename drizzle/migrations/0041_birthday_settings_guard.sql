ALTER TABLE public.birthday_message_settings ADD COLUMN IF NOT EXISTS updated_by uuid;

CREATE OR REPLACE FUNCTION public.birthday_settings_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Record who last edited the greetings (signed-in edits only).
  IF auth.uid() IS NOT NULL THEN
    NEW.updated_by := auth.uid();
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_by := OLD.updated_by;
  END IF;

  IF length(coalesce(NEW.email_subject, '')) > 150 THEN
    RAISE EXCEPTION 'Birthday email subject must be 150 characters or fewer';
  END IF;
  IF length(coalesce(NEW.email_body, '')) > 2000 THEN
    RAISE EXCEPTION 'Birthday email message must be 2000 characters or fewer';
  END IF;
  IF length(coalesce(NEW.sms_template, '')) > 480 THEN
    RAISE EXCEPTION 'Birthday text message must be 480 characters or fewer';
  END IF;
  IF length(coalesce(NEW.whatsapp_template, '')) > 1000 THEN
    RAISE EXCEPTION 'Birthday WhatsApp message must be 1000 characters or fewer';
  END IF;
  IF length(coalesce(NEW.in_app_template, '')) > 300 THEN
    RAISE EXCEPTION 'Birthday in-app message must be 300 characters or fewer';
  END IF;
  IF concat_ws(' ', NEW.email_subject, NEW.email_body, NEW.sms_template, NEW.whatsapp_template, NEW.in_app_template) ~ '<[A-Za-z/!]' THEN
    RAISE EXCEPTION 'Birthday messages must be plain text (no HTML)';
  END IF;
  IF NOT (coalesce(NEW.channels, ARRAY[]::text[]) <@ ARRAY['in_app','email','sms','whatsapp']::text[]) THEN
    RAISE EXCEPTION 'Unknown birthday message channel';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS birthday_settings_guard ON public.birthday_message_settings;
CREATE TRIGGER birthday_settings_guard
  BEFORE INSERT OR UPDATE ON public.birthday_message_settings
  FOR EACH ROW EXECUTE FUNCTION public.birthday_settings_guard();