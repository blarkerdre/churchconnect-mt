
-- Create trigger function to auto-create followups for First Timers and New Converts
CREATE OR REPLACE FUNCTION public.auto_create_followup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- On INSERT: create followup if status is First Timer or New Convert
  IF TG_OP = 'INSERT' AND NEW.membership_status IN ('First Timer', 'New Convert') THEN
    INSERT INTO public.followups (member_id, followup_type, status, priority, description, created_by)
    VALUES (
      NEW.id,
      CASE WHEN NEW.membership_status = 'First Timer' THEN 'First Timer' ELSE 'New Convert' END,
      'Pending',
      'High',
      CASE 
        WHEN NEW.membership_status = 'First Timer' THEN 'New first timer registered: ' || NEW.first_name || ' ' || NEW.last_name || '. Welcome and connect them to the church.'
        ELSE 'New convert registered: ' || NEW.first_name || ' ' || NEW.last_name || '. Enrol in BFC and assign a mentor.'
      END,
      NEW.user_id
    );
  END IF;

  -- On UPDATE: create followup if status changed TO First Timer or New Convert
  IF TG_OP = 'UPDATE' AND OLD.membership_status IS DISTINCT FROM NEW.membership_status AND NEW.membership_status IN ('First Timer', 'New Convert') THEN
    INSERT INTO public.followups (member_id, followup_type, status, priority, description, created_by)
    VALUES (
      NEW.id,
      CASE WHEN NEW.membership_status = 'First Timer' THEN 'First Timer' ELSE 'New Convert' END,
      'Pending',
      'High',
      CASE 
        WHEN NEW.membership_status = 'First Timer' THEN 'Member status changed to First Timer: ' || NEW.first_name || ' ' || NEW.last_name
        ELSE 'Member status changed to New Convert: ' || NEW.first_name || ' ' || NEW.last_name || '. Enrol in BFC and assign a mentor.'
      END,
      NEW.user_id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to members table
CREATE TRIGGER trg_auto_followup_on_member
  AFTER INSERT OR UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_followup();
