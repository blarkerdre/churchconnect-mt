
-- Add first-timer / new-convert welcome fields to members table
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS worshipped_before boolean DEFAULT null,
  ADD COLUMN IF NOT EXISTS worshipped_when_where text DEFAULT null,
  ADD COLUMN IF NOT EXISTS would_like_to_join boolean DEFAULT null,
  ADD COLUMN IF NOT EXISTS live_work_in_city boolean DEFAULT null,
  ADD COLUMN IF NOT EXISTS how_did_you_hear text DEFAULT null,
  ADD COLUMN IF NOT EXISTS attended_foundation_school boolean DEFAULT null,
  ADD COLUMN IF NOT EXISTS wofbi_highest_level text DEFAULT null,
  ADD COLUMN IF NOT EXISTS baptized_by_immersion boolean DEFAULT null,
  ADD COLUMN IF NOT EXISTS preferred_contact_modes text DEFAULT null;

-- Update the update_own_member_profile RPC to include the new fields
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
  _gender gender_type DEFAULT NULL,
  _emergency_contact_name text DEFAULT NULL,
  _emergency_contact_phone text DEFAULT NULL,
  _notes text DEFAULT NULL,
  _photo_url text DEFAULT NULL,
  _membership_status membership_status DEFAULT NULL,
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
  _preferred_contact_modes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.members
  SET
    first_name = COALESCE(_first_name, first_name),
    last_name = COALESCE(_last_name, last_name),
    email = COALESCE(_email, email),
    phone = COALESCE(_phone, phone),
    address = COALESCE(_address, address),
    city = COALESCE(_city, city),
    postcode = COALESCE(_postcode, postcode),
    date_of_birth = COALESCE(_date_of_birth, date_of_birth),
    gender = COALESCE(_gender, gender),
    emergency_contact_name = _emergency_contact_name,
    emergency_contact_phone = _emergency_contact_phone,
    notes = _notes,
    photo_url = COALESCE(_photo_url, photo_url),
    membership_status = COALESCE(_membership_status, membership_status),
    church_unit = _church_unit,
    water_baptism = COALESCE(_water_baptism, water_baptism),
    holy_spirit_baptism = COALESCE(_holy_spirit_baptism, holy_spirit_baptism),
    winners_satellite = COALESCE(_winners_satellite, winners_satellite),
    wsf_centre_id = _wsf_centre_id,
    workers_in_training = COALESCE(_workers_in_training, workers_in_training),
    bfc_completed = COALESCE(_bfc_completed, bfc_completed),
    bcc_completed = COALESCE(_bcc_completed, bcc_completed),
    lcc_completed = COALESCE(_lcc_completed, lcc_completed),
    ldc_completed = COALESCE(_ldc_completed, ldc_completed),
    worshipped_before = _worshipped_before,
    worshipped_when_where = _worshipped_when_where,
    would_like_to_join = _would_like_to_join,
    live_work_in_city = _live_work_in_city,
    how_did_you_hear = _how_did_you_hear,
    attended_foundation_school = _attended_foundation_school,
    wofbi_highest_level = _wofbi_highest_level,
    baptized_by_immersion = _baptized_by_immersion,
    preferred_contact_modes = _preferred_contact_modes,
    updated_at = now()
  WHERE id = _member_id
    AND user_id = auth.uid();
END;
$$;

-- Update the upsert_own_member_profile RPC to include the new fields
CREATE OR REPLACE FUNCTION public.upsert_own_member_profile(
  p_tenant_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_postcode text DEFAULT NULL,
  p_date_of_birth date DEFAULT NULL,
  p_gender gender_type DEFAULT NULL,
  p_membership_status membership_status DEFAULT 'First Timer',
  p_church_unit text DEFAULT NULL,
  p_emergency_contact_name text DEFAULT NULL,
  p_emergency_contact_phone text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_water_baptism boolean DEFAULT false,
  p_holy_spirit_baptism boolean DEFAULT false,
  p_winners_satellite boolean DEFAULT false,
  p_wsf_centre_id uuid DEFAULT NULL,
  p_bfc_completed boolean DEFAULT false,
  p_bcc_completed boolean DEFAULT false,
  p_lcc_completed boolean DEFAULT false,
  p_ldc_completed boolean DEFAULT false,
  p_gdpr_consent boolean DEFAULT false,
  p_worshipped_before boolean DEFAULT NULL,
  p_worshipped_when_where text DEFAULT NULL,
  p_would_like_to_join boolean DEFAULT NULL,
  p_live_work_in_city boolean DEFAULT NULL,
  p_how_did_you_hear text DEFAULT NULL,
  p_attended_foundation_school boolean DEFAULT NULL,
  p_wofbi_highest_level text DEFAULT NULL,
  p_baptized_by_immersion boolean DEFAULT NULL,
  p_preferred_contact_modes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _existing_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO _existing_id
  FROM public.members
  WHERE user_id = _user_id AND tenant_id = p_tenant_id
  LIMIT 1;

  IF _existing_id IS NOT NULL THEN
    UPDATE public.members SET
      first_name = p_first_name,
      last_name = p_last_name,
      email = COALESCE(p_email, email),
      phone = COALESCE(p_phone, phone),
      address = p_address,
      city = p_city,
      postcode = p_postcode,
      date_of_birth = p_date_of_birth,
      gender = p_gender,
      membership_status = p_membership_status,
      church_unit = p_church_unit,
      emergency_contact_name = p_emergency_contact_name,
      emergency_contact_phone = p_emergency_contact_phone,
      notes = p_notes,
      water_baptism = p_water_baptism,
      holy_spirit_baptism = p_holy_spirit_baptism,
      winners_satellite = p_winners_satellite,
      wsf_centre_id = p_wsf_centre_id,
      bfc_completed = p_bfc_completed,
      bcc_completed = p_bcc_completed,
      lcc_completed = p_lcc_completed,
      ldc_completed = p_ldc_completed,
      gdpr_consent = p_gdpr_consent,
      gdpr_consent_date = CASE WHEN p_gdpr_consent AND gdpr_consent_date IS NULL THEN now() ELSE gdpr_consent_date END,
      worshipped_before = p_worshipped_before,
      worshipped_when_where = p_worshipped_when_where,
      would_like_to_join = p_would_like_to_join,
      live_work_in_city = p_live_work_in_city,
      how_did_you_hear = p_how_did_you_hear,
      attended_foundation_school = p_attended_foundation_school,
      wofbi_highest_level = p_wofbi_highest_level,
      baptized_by_immersion = p_baptized_by_immersion,
      preferred_contact_modes = p_preferred_contact_modes,
      updated_at = now()
    WHERE id = _existing_id;
  ELSE
    INSERT INTO public.members (
      user_id, tenant_id, first_name, last_name, email, phone,
      address, city, postcode, date_of_birth, gender,
      membership_status, church_unit, emergency_contact_name, emergency_contact_phone,
      notes, water_baptism, holy_spirit_baptism, winners_satellite, wsf_centre_id,
      bfc_completed, bcc_completed, lcc_completed, ldc_completed,
      gdpr_consent, gdpr_consent_date,
      worshipped_before, worshipped_when_where, would_like_to_join,
      live_work_in_city, how_did_you_hear, attended_foundation_school,
      wofbi_highest_level, baptized_by_immersion, preferred_contact_modes
    ) VALUES (
      _user_id, p_tenant_id, p_first_name, p_last_name, p_email, p_phone,
      p_address, p_city, p_postcode, p_date_of_birth, p_gender,
      p_membership_status, p_church_unit, p_emergency_contact_name, p_emergency_contact_phone,
      p_notes, p_water_baptism, p_holy_spirit_baptism, p_winners_satellite, p_wsf_centre_id,
      p_bfc_completed, p_bcc_completed, p_lcc_completed, p_ldc_completed,
      p_gdpr_consent, CASE WHEN p_gdpr_consent THEN now() ELSE NULL END,
      p_worshipped_before, p_worshipped_when_where, p_would_like_to_join,
      p_live_work_in_city, p_how_did_you_hear, p_attended_foundation_school,
      p_wofbi_highest_level, p_baptized_by_immersion, p_preferred_contact_modes
    );

    -- Ensure tenant access
    INSERT INTO public.tenant_memberships (user_id, tenant_id, role)
    VALUES (_user_id, p_tenant_id, 'member')
    ON CONFLICT (user_id, tenant_id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role, tenant_id)
    VALUES (_user_id, 'member', p_tenant_id)
    ON CONFLICT (user_id, role, tenant_id) DO NOTHING;
  END IF;
END;
$$;
