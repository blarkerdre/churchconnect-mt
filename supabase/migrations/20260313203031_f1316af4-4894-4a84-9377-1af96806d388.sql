
-- Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text,
  type text NOT NULL DEFAULT 'general',
  reference_id text,
  reference_type text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view own notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Users can update own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- System/admins can insert notifications for anyone
CREATE POLICY "Authenticated can insert notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (true);

-- Users can delete own notifications
CREATE POLICY "Users can delete own notifications"
ON public.notifications FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Create function to notify all users (for announcements/events)
CREATE OR REPLACE FUNCTION public.notify_all_users(
  _title text,
  _message text,
  _type text DEFAULT 'general',
  _reference_id text DEFAULT NULL,
  _reference_type text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type)
  SELECT DISTINCT ur.user_id, _title, _message, _type, _reference_id, _reference_type
  FROM public.user_roles ur;
END;
$$;

-- Trigger: notify member when pastoral care status changes
CREATE OR REPLACE FUNCTION public.notify_pastoral_care_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Notify the creator
    IF NEW.created_by IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type)
      VALUES (NEW.created_by, 'Pastoral Care Update', 'Your request "' || NEW.subject || '" status changed to ' || NEW.status, 'pastoral_care', NEW.id::text, 'pastoral_care');
    END IF;
    -- Notify linked member if they have a user_id
    IF NEW.member_id IS NOT NULL THEN
      SELECT m.user_id INTO _user_id FROM public.members m WHERE m.id = NEW.member_id AND m.user_id IS NOT NULL;
      IF _user_id IS NOT NULL AND _user_id IS DISTINCT FROM NEW.created_by THEN
        INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type)
        VALUES (_user_id, 'Pastoral Care Update', 'Your pastoral care request "' || NEW.subject || '" status changed to ' || NEW.status, 'pastoral_care', NEW.id::text, 'pastoral_care');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pastoral_care_status_change
AFTER UPDATE ON public.pastoral_care
FOR EACH ROW EXECUTE FUNCTION public.notify_pastoral_care_change();

-- Trigger: notify all users on new announcement
CREATE OR REPLACE FUNCTION public.notify_new_announcement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_published = true AND (OLD IS NULL OR OLD.is_published = false) THEN
    PERFORM public.notify_all_users(
      'New Announcement: ' || NEW.title,
      LEFT(NEW.content, 200),
      'announcement',
      NEW.id::text,
      'announcement'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_new_announcement
AFTER INSERT OR UPDATE ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.notify_new_announcement();

-- Trigger: notify all users on new event
CREATE OR REPLACE FUNCTION public.notify_new_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_all_users(
    'New Event: ' || NEW.title,
    COALESCE(NEW.location, '') || ' on ' || NEW.event_date::text,
    'event',
    NEW.id::text,
    'event'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_new_event
AFTER INSERT ON public.events
FOR EACH ROW EXECUTE FUNCTION public.notify_new_event();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
