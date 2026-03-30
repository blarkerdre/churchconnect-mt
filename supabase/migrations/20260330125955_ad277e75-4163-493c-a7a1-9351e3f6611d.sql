
CREATE OR REPLACE FUNCTION public.notify_unit_leaders_on_unit_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _old_units text[];
  _new_units text[];
  _added text;
  _leader record;
  _member_name text;
  _supabase_url text;
  _service_key text;
  _i int;
BEGIN
  -- Parse comma-separated units into arrays, trimming whitespace
  IF TG_OP = 'INSERT' THEN
    _old_units := ARRAY[]::text[];
  ELSE
    _old_units := ARRAY(
      SELECT TRIM(unnest) FROM unnest(string_to_array(COALESCE(OLD.church_unit, ''), ','))
      WHERE TRIM(unnest) <> ''
    );
  END IF;

  _new_units := ARRAY(
    SELECT TRIM(unnest) FROM unnest(string_to_array(COALESCE(NEW.church_unit, ''), ','))
    WHERE TRIM(unnest) <> ''
  );

  -- If no new units or unchanged, skip
  IF _new_units IS NULL OR array_length(_new_units, 1) IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND _old_units = _new_units THEN
    RETURN NEW;
  END IF;

  _member_name := NEW.first_name || ' ' || NEW.last_name;

  -- Get vault secrets for edge function call
  SELECT decrypted_secret INTO _supabase_url FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
  SELECT decrypted_secret INTO _service_key FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;

  -- Loop through new units and find ones not in old
  FOR _i IN 1..array_length(_new_units, 1) LOOP
    _added := _new_units[_i];
    -- Skip if unit was already in old list
    IF _added = ANY(_old_units) THEN
      CONTINUE;
    END IF;

    -- Find all leaders for this unit + tenant
    FOR _leader IN
      SELECT ula.user_id
      FROM unit_leader_assignments ula
      WHERE ula.unit_name = _added
        AND (ula.tenant_id = NEW.tenant_id OR (ula.tenant_id IS NULL AND NEW.tenant_id IS NULL))
    LOOP
      -- In-app notification
      INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id, tenant_id)
      VALUES (
        _leader.user_id,
        'New Member Joined Your Unit',
        _member_name || ' has joined your unit: ' || _added,
        'general',
        'church_unit',
        _added,
        NEW.tenant_id
      );

      -- Email + SMS via edge function
      IF _supabase_url IS NOT NULL AND _service_key IS NOT NULL THEN
        PERFORM extensions.http_post(
          url := _supabase_url || '/functions/v1/notify-unit-leader',
          body := jsonb_build_object(
            'leader_user_id', _leader.user_id,
            'member_name', _member_name,
            'unit_name', _added,
            'tenant_id', NEW.tenant_id
          )::text,
          headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || _service_key)
        );
      END IF;
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_unit_leader_on_unit_change
AFTER INSERT OR UPDATE OF church_unit ON public.members
FOR EACH ROW EXECUTE FUNCTION notify_unit_leaders_on_unit_change();
