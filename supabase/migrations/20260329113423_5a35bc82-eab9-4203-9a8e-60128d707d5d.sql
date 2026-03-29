
-- Extend auto_create_followup to include regular Follow-up unit members in assignment pool
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
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.membership_status IN ('First Timer', 'New Convert'))
     OR (TG_OP = 'UPDATE' AND OLD.membership_status IS DISTINCT FROM NEW.membership_status AND NEW.membership_status IN ('First Timer', 'New Convert'))
  THEN
    _type := CASE WHEN NEW.membership_status = 'First Timer' THEN 'First Timer' ELSE 'New Convert' END;
    
    IF TG_OP = 'INSERT' THEN
      _desc := CASE 
        WHEN NEW.membership_status = 'First Timer' THEN 'New first timer registered: ' || NEW.first_name || ' ' || NEW.last_name || '. Welcome and connect them to the church.'
        ELSE 'New convert registered: ' || NEW.first_name || ' ' || NEW.last_name || '. Enrol in BFC and assign a mentor.'
      END;
    ELSE
      _desc := CASE 
        WHEN NEW.membership_status = 'First Timer' THEN 'Member status changed to First Timer: ' || NEW.first_name || ' ' || NEW.last_name
        ELSE 'Member status changed to New Convert: ' || NEW.first_name || ' ' || NEW.last_name || '. Enrol in BFC and assign a mentor.'
      END;
    END IF;

    -- Build combined assignment pool: unit leaders + regular Follow-up unit members
    SELECT pool.user_id INTO _assigned_user
    FROM (
      -- Unit leaders assigned to Follow-up
      SELECT ula.user_id 
      FROM public.unit_leader_assignments ula
      WHERE ula.unit_name IN ('Follow-up', 'Follow-Up', 'follow-up')
        AND (NEW.tenant_id IS NULL OR ula.tenant_id = NEW.tenant_id)
      UNION
      -- Regular members whose church_unit contains Follow-up and have a user_id
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

    -- Notify all Follow-up unit leaders AND regular unit members (in-app)
    FOR _fu_user IN
      SELECT sub.user_id FROM (
        SELECT ula.user_id FROM public.unit_leader_assignments ula
        WHERE ula.unit_name IN ('Follow-up', 'Follow-Up', 'follow-up')
          AND (NEW.tenant_id IS NULL OR ula.tenant_id = NEW.tenant_id)
        UNION
        SELECT m.user_id FROM public.members m
        WHERE m.user_id IS NOT NULL
          AND m.tenant_id = NEW.tenant_id
          AND (lower(m.church_unit) LIKE '%follow-up%' OR lower(m.church_unit) LIKE '%follow up%')
      ) sub
    LOOP
      INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type, tenant_id)
      VALUES (
        _fu_user.user_id,
        'New Follow-up: ' || NEW.first_name || ' ' || NEW.last_name,
        _desc,
        'general',
        _followup_id::text,
        'followup',
        NEW.tenant_id
      );
    END LOOP;

    -- Trigger email/SMS notification via edge function (async, non-blocking)
    IF _assigned_user IS NOT NULL THEN
      SELECT decrypted_secret INTO _supabase_url
      FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
      
      IF _supabase_url IS NULL THEN
        _supabase_url := current_setting('app.settings.supabase_url', true);
      END IF;

      SELECT decrypted_secret INTO _service_key
      FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;

      IF _supabase_url IS NOT NULL AND _service_key IS NOT NULL THEN
        PERFORM extensions.http_post(
          url := _supabase_url || '/functions/v1/notify-followup-assignment',
          body := jsonb_build_object(
            'assigned_to', _assigned_user,
            'member_name', NEW.first_name || ' ' || NEW.last_name,
            'description', _desc,
            'followup_id', _followup_id::text,
            'followup_type', _type
          )::text,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || _service_key
          )::jsonb
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
