
-- Create an authenticated member upsert RPC for profile creation/claiming
-- This replaces the public-register edge function for authenticated users
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
  p_gender text DEFAULT NULL,
  p_membership_status text DEFAULT NULL,
  p_church_unit text DEFAULT NULL,
  p_emergency_contact_name text DEFAULT NULL,
  p_emergency_contact_phone text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_water_baptism boolean DEFAULT NULL,
  p_holy_spirit_baptism boolean DEFAULT NULL,
  p_winners_satellite boolean DEFAULT NULL,
  p_wsf_centre_id uuid DEFAULT NULL,
  p_bfc_completed boolean DEFAULT NULL,
  p_bcc_completed boolean DEFAULT NULL,
  p_lcc_completed boolean DEFAULT NULL,
  p_ldc_completed boolean DEFAULT NULL,
  p_gdpr_consent boolean DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_member_id uuid;
  v_status membership_status;
  v_gender gender_type;
BEGIN
  -- Must be authenticated
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Must have tenant access
  IF p_tenant_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE user_id = v_uid AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'No access to this tenant';
  END IF;

  -- Validate enums
  v_status := COALESCE(p_membership_status, 'First Timer')::membership_status;
  IF p_gender IS NOT NULL AND p_gender IN ('Male', 'Female') THEN
    v_gender := p_gender::gender_type;
  ELSE
    v_gender := NULL;
  END IF;

  -- 1. Check if user already has a member row in this tenant
  SELECT id INTO v_member_id
  FROM public.members
  WHERE user_id = v_uid AND tenant_id = p_tenant_id
  LIMIT 1;

  -- 2. If not, try to claim an unlinked member by email in same tenant
  IF v_member_id IS NULL AND p_email IS NOT NULL THEN
    UPDATE public.members
    SET user_id = v_uid
    WHERE id = (
      SELECT id FROM public.members
      WHERE tenant_id = p_tenant_id
        AND user_id IS NULL
        AND lower(email) = lower(p_email)
      ORDER BY created_at ASC
      LIMIT 1
    )
    RETURNING id INTO v_member_id;
  END IF;

  -- 3. If still no member, create one
  IF v_member_id IS NULL THEN
    INSERT INTO public.members (
      tenant_id, user_id, first_name, last_name, email, phone,
      address, city, postcode, date_of_birth, gender,
      membership_status, church_unit,
      emergency_contact_name, emergency_contact_phone, notes,
      water_baptism, holy_spirit_baptism, winners_satellite,
      wsf_centre_id, bfc_completed, bcc_completed, lcc_completed, ldc_completed,
      gdpr_consent, gdpr_consent_date
    ) VALUES (
      p_tenant_id, v_uid, p_first_name, p_last_name, lower(p_email), p_phone,
      p_address, p_city, p_postcode, p_date_of_birth, v_gender,
      v_status, p_church_unit,
      p_emergency_contact_name, p_emergency_contact_phone, p_notes,
      COALESCE(p_water_baptism, false), COALESCE(p_holy_spirit_baptism, false),
      COALESCE(p_winners_satellite, false),
      CASE WHEN COALESCE(p_winners_satellite, false) THEN p_wsf_centre_id ELSE NULL END,
      COALESCE(p_bfc_completed, false), COALESCE(p_bcc_completed, false),
      COALESCE(p_lcc_completed, false), COALESCE(p_ldc_completed, false),
      COALESCE(p_gdpr_consent, false),
      CASE WHEN COALESCE(p_gdpr_consent, false) THEN now() ELSE NULL END
    )
    RETURNING id INTO v_member_id;
  ELSE
    -- 4. Update existing member
    UPDATE public.members SET
      first_name = p_first_name,
      last_name = p_last_name,
      email = COALESCE(lower(p_email), email),
      phone = COALESCE(p_phone, phone),
      address = COALESCE(p_address, address),
      city = COALESCE(p_city, city),
      postcode = COALESCE(p_postcode, postcode),
      date_of_birth = COALESCE(p_date_of_birth, date_of_birth),
      gender = COALESCE(v_gender, gender),
      membership_status = v_status,
      church_unit = COALESCE(p_church_unit, church_unit),
      emergency_contact_name = COALESCE(p_emergency_contact_name, emergency_contact_name),
      emergency_contact_phone = COALESCE(p_emergency_contact_phone, emergency_contact_phone),
      notes = COALESCE(p_notes, notes),
      water_baptism = COALESCE(p_water_baptism, water_baptism),
      holy_spirit_baptism = COALESCE(p_holy_spirit_baptism, holy_spirit_baptism),
      winners_satellite = COALESCE(p_winners_satellite, winners_satellite),
      wsf_centre_id = CASE
        WHEN COALESCE(p_winners_satellite, winners_satellite) = true
        THEN COALESCE(p_wsf_centre_id, wsf_centre_id)
        ELSE NULL
      END,
      bfc_completed = COALESCE(p_bfc_completed, bfc_completed),
      bcc_completed = COALESCE(p_bcc_completed, bcc_completed),
      lcc_completed = COALESCE(p_lcc_completed, lcc_completed),
      ldc_completed = COALESCE(p_ldc_completed, ldc_completed),
      gdpr_consent = COALESCE(p_gdpr_consent, gdpr_consent),
      gdpr_consent_date = CASE
        WHEN COALESCE(p_gdpr_consent, false) AND gdpr_consent IS NOT TRUE
        THEN now()
        ELSE gdpr_consent_date
      END,
      updated_at = now()
    WHERE id = v_member_id;
  END IF;

  RETURN v_member_id;
END;
$$;
