CREATE OR REPLACE FUNCTION public.upsert_own_member_profile(p_tenant_id uuid, p_first_name text, p_last_name text, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_postcode text DEFAULT NULL::text, p_date_of_birth date DEFAULT NULL::date, p_gender text DEFAULT NULL::text, p_membership_status text DEFAULT 'First Timer'::text, p_church_unit text DEFAULT NULL::text, p_emergency_contact_name text DEFAULT NULL::text, p_emergency_contact_phone text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_water_baptism boolean DEFAULT false, p_holy_spirit_baptism boolean DEFAULT false, p_winners_satellite boolean DEFAULT false, p_wsf_centre_id uuid DEFAULT NULL::uuid, p_bfc_completed boolean DEFAULT false, p_bcc_completed boolean DEFAULT false, p_lcc_completed boolean DEFAULT false, p_ldc_completed boolean DEFAULT false, p_gdpr_consent boolean DEFAULT false, p_worshipped_before boolean DEFAULT NULL::boolean, p_worshipped_when_where text DEFAULT NULL::text, p_would_like_to_join boolean DEFAULT NULL::boolean, p_live_work_in_city boolean DEFAULT NULL::boolean, p_how_did_you_hear text DEFAULT NULL::text, p_attended_foundation_school boolean DEFAULT NULL::boolean, p_wofbi_highest_level text DEFAULT NULL::text, p_baptized_by_immersion boolean DEFAULT NULL::boolean, p_preferred_contact_modes text DEFAULT NULL::text, p_worshipped_at_other_wci boolean DEFAULT NULL::boolean, p_occupation text DEFAULT NULL::text, p_nationality text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _member_id uuid;
  _user_email text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_tenant_id IS NULL THEN
    SELECT tenant_id INTO p_tenant_id FROM tenant_memberships WHERE user_id = _uid LIMIT 1;
  END IF;

  SELECT id INTO _member_id FROM members
  WHERE user_id = _uid AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id) LIMIT 1;

  IF _member_id IS NULL THEN
    -- Only auto-link an existing member record using the caller's own
    -- confirmed sign-in email. The email typed into the form is never
    -- trusted for matching, so nobody can claim someone else's record.
    SELECT u.email INTO _user_email FROM auth.users u
    WHERE u.id = _uid AND u.email_confirmed_at IS NOT NULL;
    IF _user_email IS NOT NULL THEN
      SELECT id INTO _member_id FROM members
      WHERE lower(email) = lower(_user_email) AND tenant_id = p_tenant_id AND user_id IS NULL LIMIT 1;
      IF _member_id IS NOT NULL THEN
        UPDATE members SET user_id = _uid WHERE id = _member_id;
      END IF;
    END IF;
  END IF;

  IF _member_id IS NOT NULL THEN
    UPDATE members SET
      first_name = p_first_name,
      last_name = p_last_name,
      email = COALESCE(p_email, email),
      phone = COALESCE(p_phone, phone),
      address = COALESCE(p_address, address),
      city = COALESCE(p_city, city),
      postcode = COALESCE(p_postcode, postcode),
      date_of_birth = p_date_of_birth,
      gender = COALESCE(p_gender::gender_type, gender),
      emergency_contact_name = COALESCE(p_emergency_contact_name, emergency_contact_name),
      emergency_contact_phone = COALESCE(p_emergency_contact_phone, emergency_contact_phone),
      notes = COALESCE(p_notes, notes),
      occupation = COALESCE(p_occupation, occupation),
      nationality = COALESCE(p_nationality, nationality),
      membership_status = COALESCE(p_membership_status::membership_status, membership_status),
      church_unit = COALESCE(p_church_unit, church_unit),
      water_baptism = p_water_baptism,
      holy_spirit_baptism = p_holy_spirit_baptism,
      winners_satellite = p_winners_satellite,
      wsf_centre_id = p_wsf_centre_id,
      bfc_completed = p_bfc_completed,
      bcc_completed = p_bcc_completed,
      lcc_completed = p_lcc_completed,
      ldc_completed = p_ldc_completed,
      gdpr_consent = p_gdpr_consent,
      gdpr_consent_date = CASE WHEN p_gdpr_consent THEN now() ELSE gdpr_consent_date END,
      worshipped_before = p_worshipped_before,
      worshipped_when_where = p_worshipped_when_where,
      would_like_to_join = p_would_like_to_join,
      live_work_in_city = p_live_work_in_city,
      how_did_you_hear = p_how_did_you_hear,
      attended_foundation_school = p_attended_foundation_school,
      wofbi_highest_level = p_wofbi_highest_level,
      baptized_by_immersion = p_baptized_by_immersion,
      preferred_contact_modes = p_preferred_contact_modes,
      worshipped_at_other_wci = p_worshipped_at_other_wci,
      updated_at = now()
    WHERE id = _member_id;
    RETURN _member_id;
  ELSE
    INSERT INTO members (
      user_id, tenant_id, first_name, last_name, email, phone, address, city, postcode,
      date_of_birth, gender, emergency_contact_name, emergency_contact_phone, notes,
      occupation, nationality,
      membership_status, church_unit, water_baptism, holy_spirit_baptism,
      winners_satellite, wsf_centre_id, bfc_completed, bcc_completed, lcc_completed, ldc_completed,
      gdpr_consent, gdpr_consent_date,
      worshipped_before, worshipped_when_where, would_like_to_join, live_work_in_city,
      how_did_you_hear, attended_foundation_school, wofbi_highest_level, baptized_by_immersion,
      preferred_contact_modes, worshipped_at_other_wci
    ) VALUES (
      _uid, p_tenant_id, p_first_name, p_last_name, p_email, p_phone, p_address, p_city, p_postcode,
      p_date_of_birth, COALESCE(p_gender::gender_type, NULL), p_emergency_contact_name, p_emergency_contact_phone, p_notes,
      p_occupation, p_nationality,
      COALESCE(p_membership_status::membership_status, 'First Timer'), p_church_unit, p_water_baptism, p_holy_spirit_baptism,
      p_winners_satellite, p_wsf_centre_id, p_bfc_completed, p_bcc_completed, p_lcc_completed, p_ldc_completed,
      p_gdpr_consent, CASE WHEN p_gdpr_consent THEN now() ELSE NULL END,
      p_worshipped_before, p_worshipped_when_where, p_would_like_to_join, p_live_work_in_city,
      p_how_did_you_hear, p_attended_foundation_school, p_wofbi_highest_level, p_baptized_by_immersion,
      p_preferred_contact_modes, p_worshipped_at_other_wci
    ) RETURNING id INTO _member_id;
    RETURN _member_id;
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.upsert_own_member_profile FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_own_member_profile TO authenticated;