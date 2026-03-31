
-- Fix all trigger functions: replace extensions.http_post with net.http_post
-- net.http_post takes jsonb body (not text) and jsonb headers

-- 1. auto_create_followup
CREATE OR REPLACE FUNCTION public.auto_create_followup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _followup_id uuid;
  _assigned_user uuid;
  _fu_user record;
  _desc text;
  _type text;
  _supabase_url text;
  _service_key text;
  _tmpl record;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.membership_status IN ('First Timer', 'New Convert', 'Visitor'))
     OR (TG_OP = 'UPDATE' AND OLD.membership_status IS DISTINCT FROM NEW.membership_status AND NEW.membership_status IN ('First Timer', 'New Convert', 'Visitor'))
  THEN
    _type := NEW.membership_status;

    IF TG_OP = 'INSERT' THEN
      _desc := CASE
        WHEN NEW.membership_status = 'First Timer' THEN 'New first timer registered: ' || NEW.first_name || ' ' || NEW.last_name || '. Welcome and connect them to the church.'
        WHEN NEW.membership_status = 'Visitor' THEN 'New visitor registered: ' || NEW.first_name || ' ' || NEW.last_name || '. Welcome and invite them back.'
        ELSE 'New convert registered: ' || NEW.first_name || ' ' || NEW.last_name || '. Enrol in BFC and assign a mentor.'
      END;
    ELSE
      _desc := CASE
        WHEN NEW.membership_status = 'First Timer' THEN 'Member status changed to First Timer: ' || NEW.first_name || ' ' || NEW.last_name
        WHEN NEW.membership_status = 'Visitor' THEN 'Member status changed to Visitor: ' || NEW.first_name || ' ' || NEW.last_name
        ELSE 'Member status changed to New Convert: ' || NEW.first_name || ' ' || NEW.last_name || '. Enrol in BFC and assign a mentor.'
      END;
    END IF;

    SELECT pool.user_id INTO _assigned_user
    FROM (
      SELECT ula.user_id
      FROM public.unit_leader_assignments ula
      WHERE ula.unit_name IN ('Follow-up', 'Follow-Up', 'follow-up')
        AND (NEW.tenant_id IS NULL OR ula.tenant_id = NEW.tenant_id)
      UNION
      SELECT m.user_id
      FROM public.members m
      WHERE m.user_id IS NOT NULL
        AND m.tenant_id = NEW.tenant_id
        AND (lower(m.church_unit) LIKE '%follow-up%' OR lower(m.church_unit) LIKE '%follow up%')
    ) pool
    ORDER BY (
      SELECT COUNT(*) FROM public.followups f
      WHERE f.assigned_to = pool.user_id AND f.status IN ('Pending', 'In Progress')
    ) ASC, random()
    LIMIT 1;

    INSERT INTO public.followups (member_id, followup_type, status, priority, description, created_by, assigned_to, tenant_id)
    VALUES (NEW.id, _type::followup_type, 'Pending', 'High', _desc, NEW.user_id, _assigned_user, NEW.tenant_id)
    RETURNING id INTO _followup_id;

    -- Auto-schedule messages from templates (now using delay_hours)
    FOR _tmpl IN
      SELECT * FROM public.followup_message_templates
      WHERE followup_type = _type
        AND is_active = true
        AND tenant_id = NEW.tenant_id
      ORDER BY sort_order, delay_hours
    LOOP
      INSERT INTO public.followup_scheduled_messages (
        followup_id, member_id, channel, recipient_phone, recipient_email,
        recipient_name, subject, message, status, scheduled_at,
        created_by, tenant_id
      ) VALUES (
        _followup_id,
        NEW.id,
        _tmpl.channel::followup_message_channel,
        NEW.phone,
        NEW.email,
        NEW.first_name || ' ' || NEW.last_name,
        _tmpl.subject,
        _tmpl.message_template,
        'scheduled',
        NOW() + (_tmpl.delay_hours * interval '1 hour'),
        _assigned_user,
        NEW.tenant_id
      );
    END LOOP;

    -- Notify follow-up unit leaders/members
    FOR _fu_user IN
      SELECT sub.user_id FROM (
        SELECT ula.user_id FROM public.unit_leader_assignments ula
        WHERE ula.unit_name IN ('Follow-up', 'Follow-Up', 'follow-up')
          AND (NEW.tenant_id IS NULL OR ula.tenant_id = NEW.tenant_id)
        UNION
        SELECT m2.user_id FROM public.members m2
        WHERE m2.user_id IS NOT NULL
          AND m2.tenant_id = NEW.tenant_id
          AND (lower(m2.church_unit) LIKE '%follow-up%' OR lower(m2.church_unit) LIKE '%follow up%')
      ) sub
    LOOP
      INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type, tenant_id)
      VALUES (
        _fu_user.user_id,
        'New Follow-up Task',
        _desc,
        'followup',
        _followup_id::text,
        'followup',
        NEW.tenant_id
      );
    END LOOP;

    -- Send email/SMS notification to assigned user via edge function
    IF _assigned_user IS NOT NULL THEN
      SELECT decrypted_secret INTO _supabase_url
      FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
      SELECT decrypted_secret INTO _service_key
      FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;

      IF _supabase_url IS NOT NULL AND _service_key IS NOT NULL THEN
        PERFORM net.http_post(
          url := _supabase_url || '/functions/v1/notify-followup-assignment',
          body := jsonb_build_object(
            'assigned_to', _assigned_user,
            'followup_id', _followup_id,
            'member_name', NEW.first_name || ' ' || NEW.last_name,
            'followup_type', _type,
            'description', _desc,
            'tenant_id', NEW.tenant_id
          ),
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || _service_key
          )
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. notify_pastoral_care_new_request
CREATE OR REPLACE FUNCTION public.notify_pastoral_care_new_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _leader_user_id uuid;
  _supabase_url text;
  _service_key text;
BEGIN
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

  IF NEW.assigned_to IS NOT NULL THEN
    SELECT decrypted_secret INTO _supabase_url
    FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
    SELECT decrypted_secret INTO _service_key
    FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;

    IF _supabase_url IS NOT NULL AND _service_key IS NOT NULL THEN
      PERFORM net.http_post(
        url := _supabase_url || '/functions/v1/notify-pastoral-assignment',
        body := jsonb_build_object(
          'assigned_to', NEW.assigned_to,
          'subject', NEW.subject,
          'care_type', NEW.care_type,
          'description', NEW.description,
          'case_id', NEW.id,
          'tenant_id', NEW.tenant_id,
          'is_new_request', true
        ),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || _service_key
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. notify_unit_leaders_on_unit_change
CREATE OR REPLACE FUNCTION public.notify_unit_leaders_on_unit_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  IF _new_units IS NULL OR array_length(_new_units, 1) IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND _old_units = _new_units THEN
    RETURN NEW;
  END IF;

  _member_name := NEW.first_name || ' ' || NEW.last_name;

  SELECT decrypted_secret INTO _supabase_url FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
  SELECT decrypted_secret INTO _service_key FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;

  FOR _i IN 1..array_length(_new_units, 1) LOOP
    _added := _new_units[_i];
    IF _added = ANY(_old_units) THEN
      CONTINUE;
    END IF;

    FOR _leader IN
      SELECT ula.user_id
      FROM unit_leader_assignments ula
      WHERE ula.unit_name = _added
        AND (ula.tenant_id = NEW.tenant_id OR (ula.tenant_id IS NULL AND NEW.tenant_id IS NULL))
    LOOP
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

      IF _supabase_url IS NOT NULL AND _service_key IS NOT NULL THEN
        PERFORM net.http_post(
          url := _supabase_url || '/functions/v1/notify-unit-leader',
          body := jsonb_build_object(
            'leader_user_id', _leader.user_id,
            'member_name', _member_name,
            'unit_name', _added,
            'tenant_id', NEW.tenant_id
          ),
          headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || _service_key)
        );
      END IF;
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- 4. notify_wsf_leader_on_centre_selection
CREATE OR REPLACE FUNCTION public.notify_wsf_leader_on_centre_selection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    PERFORM net.http_post(
      url := _supabase_url || '/functions/v1/notify-wsf-leader',
      body := jsonb_build_object(
        'leader_user_id', _leader_user_id,
        'member_name', _member_name,
        'centre_name', _centre.name,
        'centre_id', NEW.wsf_centre_id,
        'tenant_id', NEW.tenant_id
      ),
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || _service_key)
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- 5. notify_transport_assignment
CREATE OR REPLACE FUNCTION public.notify_transport_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
        'pickup_time', COALESCE(NEW.pickup_time, ''),
        'assigned_user_id', NEW.assigned_to,
        'tenant_id', NEW.tenant_id
      ),
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || _service_key)
    );
  END IF;

  RETURN NEW;
END;
$function$;
