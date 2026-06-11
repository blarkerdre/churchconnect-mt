
CREATE OR REPLACE FUNCTION public.notify_transport_leaders_on_new_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _leader RECORD;
  _member_name text;
  _supabase_url text;
  _service_key text;
  _leader_ids jsonb := '[]'::jsonb;
BEGIN
  SELECT first_name || ' ' || last_name INTO _member_name
  FROM members WHERE id = NEW.member_id AND tenant_id = NEW.tenant_id;
  IF _member_name IS NULL THEN _member_name := 'A member'; END IF;

  FOR _leader IN
    SELECT DISTINCT ula.user_id
    FROM unit_leader_assignments ula
    WHERE ula.unit_name = 'Transportation' AND ula.tenant_id = NEW.tenant_id
  LOOP
    INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id, tenant_id)
    VALUES (_leader.user_id, 'New Transport Booking',
      _member_name || ' has requested transport from ' || COALESCE(NEW.pickup_address, 'unknown') || ' on ' || COALESCE(NEW.request_date::text, 'TBC'),
      'general', 'transportation', NEW.id::text, NEW.tenant_id);
    _leader_ids := _leader_ids || to_jsonb(_leader.user_id);
  END LOOP;

  IF jsonb_array_length(_leader_ids) > 0 THEN
    SELECT decrypted_secret INTO _supabase_url FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
    SELECT decrypted_secret INTO _service_key FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;
    IF _supabase_url IS NOT NULL AND _service_key IS NOT NULL THEN
      PERFORM net.http_post(
        url := _supabase_url || '/functions/v1/notify-transport-booking',
        body := jsonb_build_object(
          'notification_type', 'new_booking',
          'booking_id', NEW.id,
          'member_name', _member_name,
          'pickup', COALESCE(NEW.pickup_address, ''),
          'destination', COALESCE(NEW.destination, 'Church'),
          'request_date', COALESCE(NEW.request_date::text, ''),
          'pickup_time', COALESCE(NEW.pickup_time::text, ''),
          'leader_user_ids', _leader_ids,
          'tenant_id', NEW.tenant_id
        ),
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || _service_key)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_transport_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _member_name text;
  _supabase_url text;
  _service_key text;
BEGIN
  IF NEW.assigned_to IS NULL THEN RETURN NEW; END IF;
  IF OLD.assigned_to IS NOT DISTINCT FROM NEW.assigned_to THEN RETURN NEW; END IF;

  SELECT first_name || ' ' || last_name INTO _member_name
  FROM members WHERE id = NEW.member_id AND tenant_id = NEW.tenant_id;
  IF _member_name IS NULL THEN _member_name := 'A member'; END IF;

  INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id, tenant_id)
  VALUES (NEW.assigned_to, 'Transport Booking Assigned to You',
    'You have been assigned to handle transport for ' || _member_name || ' from ' || COALESCE(NEW.pickup_address, 'unknown') || ' on ' || COALESCE(NEW.request_date::text, 'TBC'),
    'general', 'transportation', NEW.id::text, NEW.tenant_id);

  SELECT decrypted_secret INTO _supabase_url FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
  SELECT decrypted_secret INTO _service_key FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;
  IF _supabase_url IS NOT NULL AND _service_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := _supabase_url || '/functions/v1/notify-transport-booking',
      body := jsonb_build_object(
        'notification_type', 'assignment',
        'booking_id', NEW.id,
        'member_name', _member_name,
        'pickup', COALESCE(NEW.pickup_address, ''),
        'destination', COALESCE(NEW.destination, 'Church'),
        'request_date', COALESCE(NEW.request_date::text, ''),
        'pickup_time', COALESCE(NEW.pickup_time::text, ''),
        'assigned_user_id', NEW.assigned_to,
        'tenant_id', NEW.tenant_id
      ),
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || _service_key)
    );
  END IF;

  RETURN NEW;
END;
$$;
