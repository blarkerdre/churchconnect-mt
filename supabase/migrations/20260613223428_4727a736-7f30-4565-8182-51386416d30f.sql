
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

  INSERT INTO public.members (
    tenant_id, first_name, last_name, phone, email,
    membership_status, source, notes
  ) VALUES (
    _tenant_id,
    v_parent_first,
    v_parent_last,
    NULLIF(trim(_parent->>'phone'), ''),
    NULLIF(trim(_parent->>'email'), ''),
    'Visitor'::membership_status,
    'children_church_walkin',
    NULLIF(trim(_parent->>'notes'), '')
  ) RETURNING id INTO v_member_id;

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

    -- Link the walk-in parent as an authorised pickup adult
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

  RETURN jsonb_build_object(
    'member_id', v_member_id,
    'children', v_children_out
  );
END;
$function$;

-- Backfill: ensure every child with a primary guardian has a matching child_guardians row
INSERT INTO public.child_guardians (tenant_id, child_id, member_id, relationship, can_pickup)
SELECT c.tenant_id, c.id, c.primary_guardian_member_id, 'Parent', true
FROM public.children c
WHERE c.primary_guardian_member_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.child_guardians g
    WHERE g.child_id = c.id AND g.member_id = c.primary_guardian_member_id
  )
ON CONFLICT (child_id, member_id) DO NOTHING;
