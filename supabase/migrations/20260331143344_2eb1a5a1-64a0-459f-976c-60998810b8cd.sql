
-- Drop ALL existing overloads of update_own_member_profile
DROP FUNCTION IF EXISTS public.update_own_member_profile(uuid, text, text, text, date, text, text, text, text, text, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.update_own_member_profile(uuid, text, text, text, date, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.update_own_member_profile(uuid, text, text, text, date, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.update_own_member_profile(uuid, text, text, text, date, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.update_own_member_profile(uuid, text, text, text, date, public.gender_type, text, text, text, text, text, text, text, text, public.membership_status, text, boolean, boolean, boolean, uuid, boolean, boolean, boolean, boolean, boolean);

-- Create single canonical function
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
  _ldc_completed boolean DEFAULT NULL,
  _worshipped_before boolean DEFAULT NULL,
  _worshipped_when_where text DEFAULT NULL,
  _would_like_to_join boolean DEFAULT NULL,
  _live_work_in_city boolean DEFAULT NULL,
  _how_did_you_hear text DEFAULT NULL,
  _attended_foundation_school boolean DEFAULT NULL,
  _wofbi_highest_level text DEFAULT NULL,
  _baptized_by_immersion boolean DEFAULT NULL,
  _preferred_contact_modes text DEFAULT NULL,
  _worshipped_at_other_wci boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.members SET
    first_name = COALESCE(_first_name, first_name),
    last_name = COALESCE(_last_name, last_name),
    email = COALESCE(_email, email),
    phone = COALESCE(_phone, phone),
    address = COALESCE(_address, address),
    city = COALESCE(_city, city),
    postcode = COALESCE(_postcode, postcode),
    date_of_birth = COALESCE(_date_of_birth, date_of_birth),
    gender = COALESCE(_gender::public.gender_type, gender),
    emergency_contact_name = COALESCE(_emergency_contact_name, emergency_contact_name),
    emergency_contact_phone = COALESCE(_emergency_contact_phone, emergency_contact_phone),
    notes = COALESCE(_notes, notes),
    photo_url = COALESCE(_photo_url, photo_url),
    membership_status = COALESCE(_membership_status::public.membership_status, membership_status),
    church_unit = COALESCE(_church_unit, church_unit),
    water_baptism = COALESCE(_water_baptism, water_baptism),
    holy_spirit_baptism = COALESCE(_holy_spirit_baptism, holy_spirit_baptism),
    winners_satellite = COALESCE(_winners_satellite, winners_satellite),
    wsf_centre_id = COALESCE(_wsf_centre_id, wsf_centre_id),
    workers_in_training = COALESCE(_workers_in_training, workers_in_training),
    bfc_completed = COALESCE(_bfc_completed, bfc_completed),
    bcc_completed = COALESCE(_bcc_completed, bcc_completed),
    lcc_completed = COALESCE(_lcc_completed, lcc_completed),
    ldc_completed = COALESCE(_ldc_completed, ldc_completed),
    worshipped_before = COALESCE(_worshipped_before, worshipped_before),
    worshipped_when_where = COALESCE(_worshipped_when_where, worshipped_when_where),
    would_like_to_join = COALESCE(_would_like_to_join, would_like_to_join),
    live_work_in_city = COALESCE(_live_work_in_city, live_work_in_city),
    how_did_you_hear = COALESCE(_how_did_you_hear, how_did_you_hear),
    attended_foundation_school = COALESCE(_attended_foundation_school, attended_foundation_school),
    wofbi_highest_level = COALESCE(_wofbi_highest_level, wofbi_highest_level),
    baptized_by_immersion = COALESCE(_baptized_by_immersion, baptized_by_immersion),
    preferred_contact_modes = COALESCE(_preferred_contact_modes, preferred_contact_modes),
    worshipped_at_other_wci = COALESCE(_worshipped_at_other_wci, worshipped_at_other_wci),
    updated_at = now()
  WHERE id = _member_id AND user_id = auth.uid();
END;
$$;
