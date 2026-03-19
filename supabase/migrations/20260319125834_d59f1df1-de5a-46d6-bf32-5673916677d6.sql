
-- 1. Update RPC to include _membership_status parameter
CREATE OR REPLACE FUNCTION public.update_own_member_profile(
  _member_id uuid,
  _first_name text DEFAULT NULL,
  _last_name text DEFAULT NULL,
  _email text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _address text DEFAULT NULL,
  _city text DEFAULT NULL,
  _postcode text DEFAULT NULL,
  _date_of_birth date DEFAULT NULL,
  _gender text DEFAULT NULL,
  _emergency_contact_name text DEFAULT NULL,
  _emergency_contact_phone text DEFAULT NULL,
  _notes text DEFAULT NULL,
  _photo_url text DEFAULT NULL,
  _membership_status text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.members
    WHERE id = _member_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to update this member profile';
  END IF;

  UPDATE public.members SET
    first_name = COALESCE(_first_name, first_name),
    last_name = COALESCE(_last_name, last_name),
    email = COALESCE(_email, email),
    phone = COALESCE(_phone, phone),
    address = COALESCE(_address, address),
    city = COALESCE(_city, city),
    postcode = COALESCE(_postcode, postcode),
    date_of_birth = COALESCE(_date_of_birth, date_of_birth),
    gender = CASE WHEN _gender IS NOT NULL AND _gender IN ('Male', 'Female') THEN _gender::gender_type ELSE gender END,
    emergency_contact_name = COALESCE(_emergency_contact_name, emergency_contact_name),
    emergency_contact_phone = COALESCE(_emergency_contact_phone, emergency_contact_phone),
    notes = COALESCE(_notes, notes),
    photo_url = COALESCE(_photo_url, photo_url),
    membership_status = CASE 
      WHEN _membership_status IS NOT NULL AND _membership_status IN ('Active', 'Inactive', 'First Timer', 'New Convert') 
      THEN _membership_status::membership_status 
      ELSE membership_status 
    END,
    updated_at = now()
  WHERE id = _member_id AND user_id = auth.uid();
END;
$$;

-- 2. Auto-inactivation function: marks Active members as Inactive if they missed the last 3 closed sessions
CREATE OR REPLACE FUNCTION public.check_attendance_inactivation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _recent_sessions uuid[];
BEGIN
  -- Get the 3 most recent closed sessions (including the one just closed)
  SELECT ARRAY(
    SELECT id FROM public.attendance_sessions
    WHERE status = 'Closed'
    ORDER BY session_date DESC, created_at DESC
    LIMIT 3
  ) INTO _recent_sessions;

  -- Need at least 3 closed sessions to evaluate
  IF array_length(_recent_sessions, 1) < 3 THEN
    RETURN NEW;
  END IF;

  -- Find active members who have attended at least one session ever
  -- but have ZERO attendance records in the last 3 closed sessions → mark Inactive
  UPDATE public.members m
  SET membership_status = 'Inactive', updated_at = now()
  WHERE m.membership_status = 'Active'
    AND EXISTS (
      -- Has attended at least one session historically
      SELECT 1 FROM public.attendance_records ar WHERE ar.member_id = m.id
    )
    AND NOT EXISTS (
      -- Has no records in any of the last 3 closed sessions
      SELECT 1 FROM public.attendance_records ar
      WHERE ar.member_id = m.id
        AND ar.session_id = ANY(_recent_sessions)
    );

  RETURN NEW;
END;
$$;

-- 3. Trigger on attendance_sessions when status changes to 'Closed'
CREATE TRIGGER trg_check_inactivation
  AFTER UPDATE ON public.attendance_sessions
  FOR EACH ROW
  WHEN (NEW.status = 'Closed' AND OLD.status IS DISTINCT FROM 'Closed')
  EXECUTE FUNCTION public.check_attendance_inactivation();
