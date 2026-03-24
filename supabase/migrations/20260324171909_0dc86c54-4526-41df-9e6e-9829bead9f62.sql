
-- 1. Update notify_all_users to accept optional tenant_id and scope notifications
CREATE OR REPLACE FUNCTION public.notify_all_users(
  _title text,
  _message text,
  _type text DEFAULT 'general'::text,
  _reference_id text DEFAULT NULL::text,
  _reference_type text DEFAULT NULL::text,
  _tenant_id uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _tenant_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type, tenant_id)
    SELECT DISTINCT tm.user_id, _title, _message, _type, _reference_id, _reference_type, _tenant_id
    FROM public.tenant_memberships tm
    WHERE tm.tenant_id = _tenant_id;
  ELSE
    INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type)
    SELECT DISTINCT ur.user_id, _title, _message, _type, _reference_id, _reference_type
    FROM public.user_roles ur;
  END IF;
END;
$$;

-- 2. Update notify_new_announcement to pass tenant_id
CREATE OR REPLACE FUNCTION public.notify_new_announcement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_published = true AND (OLD IS NULL OR OLD.is_published = false) THEN
    PERFORM public.notify_all_users(
      'New Announcement: ' || NEW.title,
      LEFT(NEW.content, 200),
      'announcement',
      NEW.id::text,
      'announcement',
      NEW.tenant_id
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Update notify_new_event to pass tenant_id
CREATE OR REPLACE FUNCTION public.notify_new_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.notify_all_users(
    'New Event: ' || NEW.title,
    COALESCE(NEW.location, '') || ' on ' || NEW.event_date::text,
    'event',
    NEW.id::text,
    'event',
    NEW.tenant_id
  );
  RETURN NEW;
END;
$$;

-- 4. Update notify_pastoral_care_change to propagate tenant_id
CREATE OR REPLACE FUNCTION public.notify_pastoral_care_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.created_by IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type, tenant_id)
      VALUES (NEW.created_by, 'Pastoral Care Update', 'Your request "' || NEW.subject || '" status changed to ' || NEW.status, 'pastoral_care', NEW.id::text, 'pastoral_care', NEW.tenant_id);
    END IF;
    IF NEW.member_id IS NOT NULL THEN
      SELECT m.user_id INTO _user_id FROM public.members m WHERE m.id = NEW.member_id AND m.user_id IS NOT NULL;
      IF _user_id IS NOT NULL AND _user_id IS DISTINCT FROM NEW.created_by THEN
        INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type, tenant_id)
        VALUES (_user_id, 'Pastoral Care Update', 'Your pastoral care request "' || NEW.subject || '" status changed to ' || NEW.status, 'pastoral_care', NEW.id::text, 'pastoral_care', NEW.tenant_id);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Update track_member_status_change to propagate tenant_id
CREATE OR REPLACE FUNCTION public.track_member_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _changed_by uuid;
BEGIN
  IF OLD.membership_status IS DISTINCT FROM NEW.membership_status THEN
    BEGIN
      _changed_by := auth.uid();
    EXCEPTION WHEN OTHERS THEN
      _changed_by := NULL;
    END;

    INSERT INTO public.member_status_history (member_id, previous_status, new_status, changed_at, changed_by, tenant_id)
    VALUES (NEW.id, OLD.membership_status::text, NEW.membership_status::text, now(), _changed_by, NEW.tenant_id);
  END IF;
  RETURN NEW;
END;
$$;

-- 6. Update check_attendance_inactivation to scope by tenant
CREATE OR REPLACE FUNCTION public.check_attendance_inactivation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _recent_sessions uuid[];
BEGIN
  IF NEW.session_type != 'Unit Meeting' THEN
    RETURN NEW;
  END IF;

  SELECT ARRAY(
    SELECT id FROM public.attendance_sessions
    WHERE status = 'Closed' AND session_type = 'Unit Meeting'
      AND (NEW.tenant_id IS NULL OR tenant_id = NEW.tenant_id)
    ORDER BY session_date DESC, created_at DESC
    LIMIT 3
  ) INTO _recent_sessions;

  IF array_length(_recent_sessions, 1) < 3 THEN
    RETURN NEW;
  END IF;

  UPDATE public.members m
  SET membership_status = 'Inactive', updated_at = now()
  WHERE m.membership_status = 'Active'
    AND (NEW.tenant_id IS NULL OR m.tenant_id = NEW.tenant_id)
    AND EXISTS (
      SELECT 1 FROM public.attendance_records ar WHERE ar.member_id = m.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.attendance_records ar
      WHERE ar.member_id = m.id
        AND ar.session_id = ANY(_recent_sessions)
    );

  RETURN NEW;
END;
$$;

-- 7. Update auto_create_followup to propagate tenant_id
CREATE OR REPLACE FUNCTION public.auto_create_followup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

    IF NEW.notes IS NOT NULL AND trim(NEW.notes) != '' THEN
      _desc := _desc || E'\n\nPrayer Request: ' || left(NEW.notes, 500);
    END IF;

    -- Scope leader assignment to same tenant
    SELECT ula.user_id INTO _assigned_user
    FROM public.unit_leader_assignments ula
    WHERE ula.unit_name IN ('Follow-up', 'Follow-Up', 'follow-up')
      AND (NEW.tenant_id IS NULL OR ula.tenant_id = NEW.tenant_id)
    ORDER BY (
      SELECT COUNT(*) FROM public.followups f 
      WHERE f.assigned_to = ula.user_id AND f.status IN ('Pending', 'In Progress')
    ) ASC, random()
    LIMIT 1;

    INSERT INTO public.followups (member_id, followup_type, status, priority, description, created_by, assigned_to, tenant_id)
    VALUES (NEW.id, _type::followup_type, 'Pending', 'High', _desc, NEW.user_id, _assigned_user, NEW.tenant_id)
    RETURNING id INTO _followup_id;

    FOR _fu_user IN
      SELECT ula.user_id FROM public.unit_leader_assignments ula
      WHERE ula.unit_name IN ('Follow-up', 'Follow-Up', 'follow-up')
        AND (NEW.tenant_id IS NULL OR ula.tenant_id = NEW.tenant_id)
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
$$;
