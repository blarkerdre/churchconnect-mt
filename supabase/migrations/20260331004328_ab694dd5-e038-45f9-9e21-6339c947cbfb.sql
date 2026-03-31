
-- Create trigger function for follow-up reassignment notifications
CREATE OR REPLACE FUNCTION public.notify_followup_reassignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _supabase_url text;
  _service_key text;
  _member_name text;
  _description text;
  _followup_type text;
BEGIN
  -- Only fire when assigned_to actually changes to a new non-null user
  IF NEW.assigned_to IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to THEN
    RETURN NEW;
  END IF;

  -- Get member name for the notification
  SELECT first_name || ' ' || last_name INTO _member_name
  FROM public.members WHERE id = NEW.member_id AND tenant_id = NEW.tenant_id;
  IF _member_name IS NULL THEN
    _member_name := 'Unknown Member';
  END IF;

  _description := COALESCE(NEW.description, '');
  _followup_type := COALESCE(NEW.followup_type::text, 'follow-up');

  -- Read vault secrets
  SELECT decrypted_secret INTO _supabase_url
  FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
  SELECT decrypted_secret INTO _service_key
  FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;

  IF _supabase_url IS NOT NULL AND _service_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := _supabase_url || '/functions/v1/notify-followup-assignment',
      body := jsonb_build_object(
        'followup_id', NEW.id,
        'assigned_to', NEW.assigned_to,
        'member_name', _member_name,
        'description', _description,
        'followup_type', _followup_type,
        'tenant_id', NEW.tenant_id
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _service_key
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on followups table for reassignment
CREATE TRIGGER trg_notify_followup_reassignment
  AFTER UPDATE OF assigned_to ON public.followups
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_followup_reassignment();
