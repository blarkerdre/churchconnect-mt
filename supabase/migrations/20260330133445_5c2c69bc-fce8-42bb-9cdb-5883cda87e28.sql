
-- 1. Replace notify_new_announcement() with audience-scoped logic
CREATE OR REPLACE FUNCTION public.notify_new_announcement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only notify when published
  IF NEW.is_published IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF NEW.target_audience IS NULL OR NEW.target_audience = 'All' OR NEW.target_audience = 'All Members' THEN
    -- Notify all tenant users
    INSERT INTO public.notifications (user_id, tenant_id, title, message, type, reference_id, reference_type)
    SELECT tm.user_id, NEW.tenant_id, 'New Announcement', NEW.title, 'announcement', NEW.id::text, 'announcement'
    FROM public.tenant_memberships tm
    WHERE tm.tenant_id = NEW.tenant_id
      AND tm.user_id IS NOT NULL
      AND tm.user_id != COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000');

  ELSIF NEW.target_audience = 'Leaders Only' THEN
    -- Notify unit leaders and wsf leaders
    INSERT INTO public.notifications (user_id, tenant_id, title, message, type, reference_id, reference_type)
    SELECT DISTINCT ur.user_id, NEW.tenant_id, 'New Announcement', NEW.title, 'announcement', NEW.id::text, 'announcement'
    FROM public.user_roles ur
    WHERE ur.tenant_id = NEW.tenant_id
      AND ur.role IN ('unit_leader', 'wsf_leader', 'admin')
      AND ur.user_id != COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000');

  ELSE
    -- Specific unit or centre name — notify matching members
    INSERT INTO public.notifications (user_id, tenant_id, title, message, type, reference_id, reference_type)
    SELECT DISTINCT m.user_id, NEW.tenant_id, 'New Announcement', NEW.title, 'announcement', NEW.id::text, 'announcement'
    FROM public.members m
    WHERE m.tenant_id = NEW.tenant_id
      AND m.user_id IS NOT NULL
      AND m.user_id != COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000')
      AND (
        m.church_unit ILIKE '%' || NEW.target_audience || '%'
        OR m.wsf_centre_id IN (
          SELECT wc.id FROM public.wsf_centres wc
          WHERE wc.tenant_id = NEW.tenant_id AND wc.name = NEW.target_audience
        )
      );
  END IF;

  RETURN NEW;
END;
$$;

-- Drop and recreate trigger to ensure it fires correctly
DROP TRIGGER IF EXISTS trg_new_announcement ON public.announcements;
CREATE TRIGGER trg_new_announcement
  AFTER INSERT OR UPDATE OF is_published ON public.announcements
  FOR EACH ROW
  WHEN (NEW.is_published = true)
  EXECUTE FUNCTION public.notify_new_announcement();


-- 2. Replace notify_new_event() with audience-scoped logic
CREATE OR REPLACE FUNCTION public.notify_new_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.audience IS NULL OR NEW.audience = 'All Members' THEN
    INSERT INTO public.notifications (user_id, tenant_id, title, message, type, reference_id, reference_type)
    SELECT tm.user_id, NEW.tenant_id,
      'New Event: ' || NEW.title,
      COALESCE(NEW.description, 'A new event has been scheduled for ' || NEW.event_date::text),
      'event', NEW.id::text, 'event'
    FROM public.tenant_memberships tm
    WHERE tm.tenant_id = NEW.tenant_id
      AND tm.user_id IS NOT NULL
      AND tm.user_id != COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000');

  ELSIF NEW.audience = 'Leaders Only' THEN
    INSERT INTO public.notifications (user_id, tenant_id, title, message, type, reference_id, reference_type)
    SELECT DISTINCT ur.user_id, NEW.tenant_id,
      'New Event: ' || NEW.title,
      COALESCE(NEW.description, 'A new event has been scheduled for ' || NEW.event_date::text),
      'event', NEW.id::text, 'event'
    FROM public.user_roles ur
    WHERE ur.tenant_id = NEW.tenant_id
      AND ur.role IN ('unit_leader', 'wsf_leader', 'admin')
      AND ur.user_id != COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000');

  ELSIF NEW.audience = 'WSF' THEN
    INSERT INTO public.notifications (user_id, tenant_id, title, message, type, reference_id, reference_type)
    SELECT DISTINCT m.user_id, NEW.tenant_id,
      'New Event: ' || NEW.title,
      COALESCE(NEW.description, 'A new event has been scheduled for ' || NEW.event_date::text),
      'event', NEW.id::text, 'event'
    FROM public.members m
    WHERE m.tenant_id = NEW.tenant_id
      AND m.user_id IS NOT NULL
      AND m.wsf_centre_id IS NOT NULL
      AND m.user_id != COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000');

  ELSIF NEW.audience = 'WSF Leaders' THEN
    INSERT INTO public.notifications (user_id, tenant_id, title, message, type, reference_id, reference_type)
    SELECT DISTINCT ur.user_id, NEW.tenant_id,
      'New Event: ' || NEW.title,
      COALESCE(NEW.description, 'A new event has been scheduled for ' || NEW.event_date::text),
      'event', NEW.id::text, 'event'
    FROM public.user_roles ur
    WHERE ur.tenant_id = NEW.tenant_id
      AND ur.role = 'wsf_leader'
      AND ur.user_id != COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000');

  ELSE
    -- Specific unit or centre name
    INSERT INTO public.notifications (user_id, tenant_id, title, message, type, reference_id, reference_type)
    SELECT DISTINCT m.user_id, NEW.tenant_id,
      'New Event: ' || NEW.title,
      COALESCE(NEW.description, 'A new event has been scheduled for ' || NEW.event_date::text),
      'event', NEW.id::text, 'event'
    FROM public.members m
    WHERE m.tenant_id = NEW.tenant_id
      AND m.user_id IS NOT NULL
      AND m.user_id != COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000')
      AND (
        m.church_unit ILIKE '%' || NEW.audience || '%'
        OR m.wsf_centre_id IN (
          SELECT wc.id FROM public.wsf_centres wc
          WHERE wc.tenant_id = NEW.tenant_id AND wc.name = NEW.audience
        )
      );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_event ON public.events;
CREATE TRIGGER trg_new_event
  AFTER INSERT ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_event();


-- 3. New trigger: notify on new meeting (attendance session)
CREATE OR REPLACE FUNCTION public.notify_new_meeting()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.session_type = 'Unit Meeting' AND NEW.unit IS NOT NULL THEN
    -- Notify members in that unit + unit leaders
    INSERT INTO public.notifications (user_id, tenant_id, title, message, type, reference_id, reference_type)
    SELECT DISTINCT m.user_id, NEW.tenant_id,
      'New Meeting: ' || COALESCE(NEW.title, NEW.unit || ' Meeting'),
      'A ' || NEW.unit || ' meeting has been scheduled for ' || NEW.session_date::text,
      'general', NEW.id::text, 'attendance_session'
    FROM public.members m
    WHERE m.tenant_id = NEW.tenant_id
      AND m.user_id IS NOT NULL
      AND m.user_id != COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000')
      AND m.church_unit ILIKE '%' || NEW.unit || '%';

    -- Also notify unit leaders who may not be members of the unit
    INSERT INTO public.notifications (user_id, tenant_id, title, message, type, reference_id, reference_type)
    SELECT DISTINCT ula.user_id, NEW.tenant_id,
      'New Meeting: ' || COALESCE(NEW.title, NEW.unit || ' Meeting'),
      'A ' || NEW.unit || ' meeting has been scheduled for ' || NEW.session_date::text,
      'general', NEW.id::text, 'attendance_session'
    FROM public.unit_leader_assignments ula
    WHERE ula.tenant_id = NEW.tenant_id
      AND ula.unit_name = NEW.unit
      AND ula.user_id != COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000')
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = ula.user_id
          AND n.reference_id = NEW.id::text
          AND n.reference_type = 'attendance_session'
          AND n.tenant_id = NEW.tenant_id
      );
  ELSE
    -- General meeting — notify all tenant users
    INSERT INTO public.notifications (user_id, tenant_id, title, message, type, reference_id, reference_type)
    SELECT tm.user_id, NEW.tenant_id,
      'New Meeting: ' || COALESCE(NEW.title, NEW.session_type::text),
      'A ' || NEW.session_type::text || ' meeting has been scheduled for ' || NEW.session_date::text,
      'general', NEW.id::text, 'attendance_session'
    FROM public.tenant_memberships tm
    WHERE tm.tenant_id = NEW.tenant_id
      AND tm.user_id IS NOT NULL
      AND tm.user_id != COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_new_meeting
  AFTER INSERT ON public.attendance_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_meeting();


-- 4. New trigger: notify on meeting closed
CREATE OR REPLACE FUNCTION public.notify_meeting_closed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attendance_count integer;
  v_title text;
BEGIN
  -- Only fire when status changes to 'Closed'
  IF NEW.status != 'Closed' OR OLD.status = 'Closed' THEN
    RETURN NEW;
  END IF;

  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_attendance_count
  FROM public.attendance_records
  WHERE session_id = NEW.id;

  v_title := COALESCE(NEW.title, COALESCE(NEW.unit, '') || ' ' || NEW.session_type::text);

  IF NEW.session_type = 'Unit Meeting' AND NEW.unit IS NOT NULL THEN
    -- Notify unit leaders
    INSERT INTO public.notifications (user_id, tenant_id, title, message, type, reference_id, reference_type)
    SELECT DISTINCT ula.user_id, NEW.tenant_id,
      'Meeting Closed: ' || v_title,
      v_title || ' on ' || NEW.session_date::text || ' has been closed. Attendance: ' || v_attendance_count,
      'general', NEW.id::text, 'attendance_session'
    FROM public.unit_leader_assignments ula
    WHERE ula.tenant_id = NEW.tenant_id
      AND ula.unit_name = NEW.unit;
  ELSE
    -- Notify admins
    INSERT INTO public.notifications (user_id, tenant_id, title, message, type, reference_id, reference_type)
    SELECT DISTINCT ur.user_id, NEW.tenant_id,
      'Meeting Closed: ' || v_title,
      v_title || ' on ' || NEW.session_date::text || ' has been closed. Attendance: ' || v_attendance_count,
      'general', NEW.id::text, 'attendance_session'
    FROM public.user_roles ur
    WHERE ur.tenant_id = NEW.tenant_id
      AND ur.role = 'admin';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_meeting_closed
  AFTER UPDATE OF status ON public.attendance_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_meeting_closed();
