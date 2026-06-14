CREATE OR REPLACE FUNCTION public.register_walkin_family(_tenant_id uuid, _parent jsonb, _children jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_member_id UUID;
  v_child JSONB;
  v_child_id UUID;
  v_children_out JSONB := '[]'::jsonb;
  v_parent_first TEXT := NULLIF(trim(_parent->>'first_name'), '');
  v_parent_last  TEXT := NULLIF(trim(_parent->>'last_name'), '');
  v_parent_email TEXT := NULLIF(trim(_parent->>'email'), '');
  v_parent_phone TEXT := NULLIF(trim(_parent->>'phone'), '');
  v_parent_notes TEXT := NULLIF(trim(_parent->>'notes'), '');
  v_email_norm TEXT := lower(v_parent_email);
  v_phone_digits TEXT := regexp_replace(coalesce(v_parent_phone,''), '\D', '', 'g');
  v_phone_suffix TEXT := CASE WHEN length(v_phone_digits) >= 10 THEN right(v_phone_digits, 10) ELSE NULL END;
BEGIN
  IF NOT public.user_has_tenant_access(_tenant_id) THEN
    RAISE EXCEPTION 'Not authorised for this tenant';
  END IF;
  IF v_parent_first IS NULL OR v_parent_last IS NULL THEN
    RAISE EXCEPTION 'Parent first and last name are required';
  END IF;
  IF jsonb_typeof(_children) <> 'array' OR jsonb_array_length(_children) = 0 THEN
    RAISE EXCEPTION 'At least one child is required';
  END IF;

  -- 1) Try match by email
  IF v_email_norm IS NOT NULL THEN
    SELECT id INTO v_member_id
    FROM public.members
    WHERE tenant_id = _tenant_id AND lower(email) = v_email_norm
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- 2) Try match by phone suffix
  IF v_member_id IS NULL AND v_phone_suffix IS NOT NULL THEN
    SELECT id INTO v_member_id
    FROM public.members
    WHERE tenant_id = _tenant_id
      AND phone IS NOT NULL
      AND right(regexp_replace(phone, '\D', '', 'g'), 10) = v_phone_suffix
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_member_id IS NOT NULL THEN
    -- Reuse existing member; only fill blank contact fields, never overwrite or downgrade status
    UPDATE public.members
    SET email = COALESCE(email, v_parent_email),
        phone = COALESCE(phone, v_parent_phone)
    WHERE id = v_member_id;
  ELSE
    INSERT INTO public.members (
      tenant_id, first_name, last_name, phone, email,
      membership_status, source, notes
    ) VALUES (
      _tenant_id,
      v_parent_first,
      v_parent_last,
      v_parent_phone,
      v_parent_email,
      'Visitor'::membership_status,
      'children_church_walkin',
      v_parent_notes
    ) RETURNING id INTO v_member_id;
  END IF;

  FOR v_child IN SELECT * FROM jsonb_array_elements(_children) LOOP
    INSERT INTO public.children (
      tenant_id, primary_guardian_member_id,
      first_name, last_name,
      date_of_birth, gender, age_group,
      allergies, medical_notes, notes
    ) VALUES (
      _tenant_id, v_member_id,
      NULLIF(trim(v_child->>'first_name'), ''),
      NULLIF(trim(v_child->>'last_name'), ''),
      NULLIF(v_child->>'date_of_birth','')::date,
      NULLIF(v_child->>'gender',''),
      NULLIF(v_child->>'age_group',''),
      NULLIF(trim(v_child->>'allergies'), ''),
      NULLIF(trim(v_child->>'medical_notes'), ''),
      NULLIF(trim(v_child->>'notes'), '')
    ) RETURNING id INTO v_child_id;

    INSERT INTO public.child_guardians (tenant_id, child_id, member_id, relationship, can_pickup)
    VALUES (_tenant_id, v_child_id, v_member_id, 'Parent', true)
    ON CONFLICT (child_id, member_id) DO NOTHING;

    v_children_out := v_children_out || jsonb_build_object(
      'id', v_child_id,
      'first_name', v_child->>'first_name',
      'last_name', v_child->>'last_name',
      'age_group', v_child->>'age_group',
      'allergies', v_child->>'allergies'
    );
  END LOOP;

  RETURN jsonb_build_object('member_id', v_member_id, 'children', v_children_out);
END;
$function$;