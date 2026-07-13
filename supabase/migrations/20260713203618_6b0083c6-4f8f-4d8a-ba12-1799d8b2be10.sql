
CREATE OR REPLACE FUNCTION public.delete_bible_school_application_only(_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant_id uuid;
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_deleted int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT tenant_id INTO v_tenant_id FROM public.wofbi_applications WHERE id = _application_id;
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'Application not found'; END IF;

  v_is_admin := public.has_role(v_uid, 'super_admin'::public.app_role)
             OR public.has_role(v_uid, 'admin'::public.app_role)
             OR EXISTS (
                  SELECT 1 FROM public.tenant_memberships tm
                  WHERE tm.user_id = v_uid
                    AND tm.tenant_id = v_tenant_id
                    AND tm.role IN ('owner'::public.tenant_role, 'admin'::public.tenant_role)
                );
  IF NOT v_is_admin THEN RAISE EXCEPTION 'Not authorised'; END IF;

  WITH del AS (
    DELETE FROM public.wofbi_applications
    WHERE id = _application_id AND tenant_id = v_tenant_id
    RETURNING 1
  ) SELECT count(*) INTO v_deleted FROM del;

  INSERT INTO public.audit_log (user_id, tenant_id, action, entity_type, entity_id, details)
  VALUES (v_uid, v_tenant_id, 'wofbi_application.deleted', 'wofbi_applications', _application_id,
    jsonb_build_object('scope','application_only'));

  RETURN jsonb_build_object('applications', v_deleted);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_bible_school_registration_only(_registration_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant_id uuid;
  v_member_id uuid;
  v_course_id uuid;
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_training_types text[];
  v_subject_ids uuid[];
  v_del_answers int := 0;
  v_del_attempts int := 0;
  v_del_completions int := 0;
  v_del_ratings int := 0;
  v_del_registrations int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT tenant_id, member_id, course_id
    INTO v_tenant_id, v_member_id, v_course_id
    FROM public.course_registrations WHERE id = _registration_id;
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'Registration not found'; END IF;

  v_is_admin := public.has_role(v_uid, 'super_admin'::public.app_role)
             OR public.has_role(v_uid, 'admin'::public.app_role)
             OR EXISTS (
                  SELECT 1 FROM public.tenant_memberships tm
                  WHERE tm.user_id = v_uid
                    AND tm.tenant_id = v_tenant_id
                    AND tm.role IN ('owner'::public.tenant_role, 'admin'::public.tenant_role)
                );
  IF NOT v_is_admin THEN RAISE EXCEPTION 'Not authorised'; END IF;

  SELECT ARRAY(SELECT name FROM public.exam_titles WHERE id = v_course_id AND tenant_id = v_tenant_id)
    INTO v_training_types;
  SELECT ARRAY(SELECT id FROM public.exam_subjects WHERE course_id = v_course_id AND tenant_id = v_tenant_id)
    INTO v_subject_ids;

  WITH del AS (
    DELETE FROM public.exam_answers ea
    WHERE ea.attempt_id IN (
      SELECT id FROM public.exam_attempts
      WHERE member_id = v_member_id AND tenant_id = v_tenant_id
        AND ((v_subject_ids IS NOT NULL AND subject_id = ANY(v_subject_ids))
          OR (v_training_types IS NOT NULL AND training_type = ANY(v_training_types)))
    )
    RETURNING 1
  ) SELECT count(*) INTO v_del_answers FROM del;

  WITH del AS (
    DELETE FROM public.exam_attempts
    WHERE member_id = v_member_id AND tenant_id = v_tenant_id
      AND ((v_subject_ids IS NOT NULL AND subject_id = ANY(v_subject_ids))
        OR (v_training_types IS NOT NULL AND training_type = ANY(v_training_types)))
    RETURNING 1
  ) SELECT count(*) INTO v_del_attempts FROM del;

  WITH del AS (
    DELETE FROM public.lecturer_ratings
    WHERE member_id = v_member_id AND tenant_id = v_tenant_id AND course_id = v_course_id
    RETURNING 1
  ) SELECT count(*) INTO v_del_ratings FROM del;

  WITH del AS (
    DELETE FROM public.training_completions
    WHERE member_id = v_member_id AND tenant_id = v_tenant_id
      AND training_type = ANY(v_training_types)
    RETURNING 1
  ) SELECT count(*) INTO v_del_completions FROM del;

  WITH del AS (
    DELETE FROM public.course_registrations
    WHERE id = _registration_id AND tenant_id = v_tenant_id
    RETURNING 1
  ) SELECT count(*) INTO v_del_registrations FROM del;

  INSERT INTO public.audit_log (user_id, tenant_id, action, entity_type, entity_id, details)
  VALUES (v_uid, v_tenant_id, 'course_registration.deleted', 'course_registrations', _registration_id,
    jsonb_build_object(
      'scope','registration_only',
      'answers', v_del_answers,
      'attempts', v_del_attempts,
      'ratings', v_del_ratings,
      'completions', v_del_completions,
      'registrations', v_del_registrations
    ));

  RETURN jsonb_build_object(
    'answers', v_del_answers,
    'attempts', v_del_attempts,
    'ratings', v_del_ratings,
    'completions', v_del_completions,
    'registrations', v_del_registrations
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_bible_school_application_only(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_bible_school_registration_only(uuid) TO authenticated;
