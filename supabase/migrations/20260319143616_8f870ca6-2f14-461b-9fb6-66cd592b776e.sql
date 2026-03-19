
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
  _membership_status text DEFAULT NULL,
  _church_unit text DEFAULT NULL,
  _water_baptism boolean DEFAULT NULL,
  _holy_spirit_baptism boolean DEFAULT NULL,
  _winners_satellite boolean DEFAULT NULL,
  _wsf_centre_id uuid DEFAULT NULL,
  _workers_in_training boolean DEFAULT NULL,
  _bfc_completed boolean DEFAULT NULL,
  _bcc_completed boolean DEFAULT NULL,
  _lcc_completed boolean DEFAULT NULL,
  _ldc_completed boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    church_unit = COALESCE(_church_unit, church_unit),
    water_baptism = COALESCE(_water_baptism, water_baptism),
    holy_spirit_baptism = COALESCE(_holy_spirit_baptism, holy_spirit_baptism),
    winners_satellite = COALESCE(_winners_satellite, winners_satellite),
    wsf_centre_id = CASE WHEN _winners_satellite = true THEN COALESCE(_wsf_centre_id, wsf_centre_id) WHEN _winners_satellite = false THEN NULL ELSE COALESCE(_wsf_centre_id, wsf_centre_id) END,
    workers_in_training = COALESCE(_workers_in_training, workers_in_training),
    bfc_completed = COALESCE(_bfc_completed, bfc_completed),
    bcc_completed = COALESCE(_bcc_completed, bcc_completed),
    lcc_completed = COALESCE(_lcc_completed, lcc_completed),
    ldc_completed = COALESCE(_ldc_completed, ldc_completed),
    updated_at = now()
  WHERE id = _member_id AND user_id = auth.uid();
END;
$$;
