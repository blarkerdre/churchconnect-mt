
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
BEGIN
  -- Determine if we should create a followup
  IF (TG_OP = 'INSERT' AND NEW.membership_status IN ('First Timer', 'New Convert'))
     OR (TG_OP = 'UPDATE' AND OLD.membership_status IS DISTINCT FROM NEW.membership_status AND NEW.membership_status IN ('First Timer', 'New Convert'))
  THEN
    -- Determine type and description
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

    -- Pick a Follow-up unit member to assign (round-robin by least assigned pending followups)
    SELECT ula.user_id INTO _assigned_user
    FROM public.unit_leader_assignments ula
    WHERE ula.unit_name IN ('Follow-up', 'Follow-Up', 'follow-up')
    ORDER BY (
      SELECT COUNT(*) FROM public.followups f 
      WHERE f.assigned_to = ula.user_id AND f.status IN ('Pending', 'In Progress')
    ) ASC, random()
    LIMIT 1;

    -- Insert the followup
    INSERT INTO public.followups (member_id, followup_type, status, priority, description, created_by, assigned_to)
    VALUES (NEW.id, _type::followup_type, 'Pending', 'High', _desc, NEW.user_id, _assigned_user)
    RETURNING id INTO _followup_id;

    -- Notify all Follow-up unit members
    FOR _fu_user IN
      SELECT ula.user_id FROM public.unit_leader_assignments ula
      WHERE ula.unit_name IN ('Follow-up', 'Follow-Up', 'follow-up')
    LOOP
      INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type)
      VALUES (
        _fu_user.user_id,
        'New Follow-up: ' || NEW.first_name || ' ' || NEW.last_name,
        _desc,
        'general',
        _followup_id::text,
        'followup'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;
