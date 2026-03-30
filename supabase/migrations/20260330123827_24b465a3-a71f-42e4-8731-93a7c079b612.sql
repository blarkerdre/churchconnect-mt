
CREATE OR REPLACE FUNCTION public.notify_pastoral_care_new_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _leader_user_id uuid;
  _supabase_url text;
  _service_key text;
BEGIN
  -- 1. In-app notification to assigned user
  IF NEW.assigned_to IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type, tenant_id)
    VALUES (
      NEW.assigned_to,
      'New Pastoral Care Case Assigned',
      'A new ' || COALESCE(NEW.care_type::text, 'pastoral care') || ' request has been assigned to you: "' || NEW.subject || '"',
      'pastoral_care',
      NEW.id::text,
      'pastoral_care',
      NEW.tenant_id
    );
  END IF;

  -- 2. Notify all Pastoral Care unit leaders (except the assigned user, to avoid duplicate)
  FOR _leader_user_id IN
    SELECT ula.user_id FROM public.unit_leader_assignments ula
    WHERE lower(ula.unit_name) = 'pastoral care'
      AND (ula.tenant_id = NEW.tenant_id OR (NEW.tenant_id IS NULL AND ula.tenant_id IS NULL))
      AND ula.user_id IS DISTINCT FROM NEW.assigned_to
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type, tenant_id)
    VALUES (
      _leader_user_id,
      'New Pastoral Care Request',
      'A new ' || COALESCE(NEW.care_type::text, 'pastoral care') || ' request: "' || NEW.subject || '"',
      'pastoral_care',
      NEW.id::text,
      'pastoral_care',
      NEW.tenant_id
    );
  END LOOP;

  -- 3. Send email+SMS to assigned user via edge function
  IF NEW.assigned_to IS NOT NULL THEN
    SELECT decrypted_secret INTO _supabase_url
    FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;

    SELECT decrypted_secret INTO _service_key
    FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;

    IF _supabase_url IS NOT NULL AND _service_key IS NOT NULL THEN
      PERFORM extensions.http_post(
        url := _supabase_url || '/functions/v1/notify-pastoral-assignment',
        body := jsonb_build_object(
          'assigned_to', NEW.assigned_to,
          'subject', NEW.subject,
          'care_type', NEW.care_type,
          'description', NEW.description,
          'case_id', NEW.id,
          'tenant_id', NEW.tenant_id,
          'is_new_request', true
        )::text,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || _service_key
        )::jsonb
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_pastoral_care_new_request ON public.pastoral_care;
CREATE TRIGGER trg_pastoral_care_new_request
AFTER INSERT ON public.pastoral_care
FOR EACH ROW EXECUTE FUNCTION public.notify_pastoral_care_new_request();
