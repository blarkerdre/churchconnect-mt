-- Drop unused columns from events
ALTER TABLE public.events DROP COLUMN IF EXISTS target_unit;
ALTER TABLE public.events DROP COLUMN IF EXISTS target_wsf_centre_id;

-- Add audience column to events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'All Members';

-- Create member_status_history table
CREATE TABLE public.member_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid
);

ALTER TABLE public.member_status_history ENABLE ROW LEVEL SECURITY;

-- RLS: admins/leaders can view
CREATE POLICY "Admins/leaders can view status history"
  ON public.member_status_history FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role) OR has_role(auth.uid(), 'wsf_leader'::app_role));

-- RLS: members can view own history
CREATE POLICY "Members can view own status history"
  ON public.member_status_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.members m WHERE m.id = member_status_history.member_id AND m.user_id = auth.uid()));

-- Trigger function to track status changes
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

    INSERT INTO public.member_status_history (member_id, previous_status, new_status, changed_at, changed_by)
    VALUES (NEW.id, OLD.membership_status::text, NEW.membership_status::text, now(), _changed_by);
  END IF;
  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER trg_track_member_status_change
  BEFORE UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.track_member_status_change();

-- Update events RLS to include wsf_leader
DROP POLICY IF EXISTS "Admins can manage events" ON public.events;
CREATE POLICY "Admins/leaders can manage events"
  ON public.events FOR ALL TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role) OR has_role(auth.uid(), 'wsf_leader'::app_role))
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role) OR has_role(auth.uid(), 'wsf_leader'::app_role));

-- Update announcements RLS to include wsf_leader
DROP POLICY IF EXISTS "Admins/leaders can manage announcements" ON public.announcements;
CREATE POLICY "Admins/leaders can manage announcements"
  ON public.announcements FOR ALL TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role) OR has_role(auth.uid(), 'wsf_leader'::app_role))
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role) OR has_role(auth.uid(), 'wsf_leader'::app_role));

-- Update sms_log RLS to include wsf_leader
DROP POLICY IF EXISTS "Admins/leaders can insert sms logs" ON public.sms_log;
CREATE POLICY "Admins/leaders can insert sms logs"
  ON public.sms_log FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role) OR has_role(auth.uid(), 'wsf_leader'::app_role));

DROP POLICY IF EXISTS "Admins/leaders can view sms logs" ON public.sms_log;
CREATE POLICY "Admins/leaders can view sms logs"
  ON public.sms_log FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role) OR has_role(auth.uid(), 'wsf_leader'::app_role));