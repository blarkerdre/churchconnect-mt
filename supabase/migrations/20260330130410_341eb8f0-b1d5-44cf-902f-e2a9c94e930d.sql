
CREATE OR REPLACE FUNCTION public.notify_wsf_leader_on_centre_selection()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _centre record;
  _leader_user_id uuid;
  _member_name text;
  _supabase_url text;
  _service_key text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.wsf_centre_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND (NEW.wsf_centre_id IS NOT DISTINCT FROM OLD.wsf_centre_id) THEN RETURN NEW; END IF;
  IF NEW.wsf_centre_id IS NULL THEN RETURN NEW; END IF;

  SELECT leader_id, name INTO _centre FROM wsf_centres
  WHERE id = NEW.wsf_centre_id AND tenant_id = NEW.tenant_id;
  IF _centre.leader_id IS NULL THEN RETURN NEW; END IF;

  SELECT user_id INTO _leader_user_id FROM members
  WHERE id = _centre.leader_id AND tenant_id = NEW.tenant_id;
  IF _leader_user_id IS NULL THEN RETURN NEW; END IF;

  _member_name := NEW.first_name || ' ' || NEW.last_name;

  INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id, tenant_id)
  VALUES (_leader_user_id, 'New Member Joined Your WSF Centre',
    _member_name || ' has selected your WSF centre: ' || _centre.name,
    'general', 'wsf_centre', NEW.wsf_centre_id::text, NEW.tenant_id);

  SELECT decrypted_secret INTO _supabase_url FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
  SELECT decrypted_secret INTO _service_key FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;
  IF _supabase_url IS NOT NULL AND _service_key IS NOT NULL THEN
    PERFORM extensions.http_post(
      url := _supabase_url || '/functions/v1/notify-wsf-leader',
      body := jsonb_build_object(
        'leader_user_id', _leader_user_id,
        'member_name', _member_name,
        'centre_name', _centre.name,
        'centre_id', NEW.wsf_centre_id,
        'tenant_id', NEW.tenant_id
      )::text,
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || _service_key)::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$;
