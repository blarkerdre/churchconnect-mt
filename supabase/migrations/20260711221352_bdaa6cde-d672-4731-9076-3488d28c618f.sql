
CREATE OR REPLACE FUNCTION public.cascade_delete_bible_school_records(
  _member_id uuid,
  _course_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_training_types text[];
  v_subject_ids uuid[];
  v_del_answers int := 0;
  v_del_attempts int := 0;
  v_del_completions int := 0;
  v_del_ratings int := 0;
  v_del_registrations int := 0;
  v_del_applications int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT tenant_id INTO v_tenant_id FROM public.members WHERE id = _member_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  -- Authorisation: super admin, app admin, or tenant owner/admin for this tenant
  v_is_admin := public.has_role(v_uid, 'super_admin'::public.app_role)
             OR public.has_role(v_uid, 'admin'::public.app_role)
             OR EXISTS (
                  SELECT 1 FROM public.tenant_memberships tm
                  WHERE tm.user_id = v_uid
                    AND tm.tenant_id = v_tenant_id
                    AND tm.role IN ('owner'::public.tenant_role, 'admin'::public.tenant_role)
                );
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Not authorised to delete Bible School records for this member';
  END IF;

  -- Resolve training_types and subjects (scoped to course_id if given, else all courses in tenant)
  IF _course_id IS NOT NULL THEN
    SELECT ARRAY(SELECT name FROM public.exam_titles WHERE id = _course_id AND tenant_id = v_tenant_id)
      INTO v_training_types;
    SELECT ARRAY(SELECT id FROM public.exam_subjects WHERE course_id = _course_id AND tenant_id = v_tenant_id)
      INTO v_subject_ids;
  ELSE
    v_training_types := ARRAY(SELECT name FROM public.exam_titles WHERE tenant_id = v_tenant_id);
    v_subject_ids := ARRAY(SELECT id FROM public.exam_subjects WHERE tenant_id = v_tenant_id);
  END IF;

  -- 1) exam_answers via attempts
  WITH del AS (
    DELETE FROM public.exam_answers ea
    WHERE ea.attempt_id IN (
      SELECT id FROM public.exam_attempts
      WHERE member_id = _member_id
        AND tenant_id = v_tenant_id
        AND (
          (v_subject_ids IS NOT NULL AND subject_id = ANY(v_subject_ids))
          OR (v_training_types IS NOT NULL AND training_type = ANY(v_training_types))
        )
    )
    RETURNING 1
  ) SELECT count(*) INTO v_del_answers FROM del;

  -- 2) exam_attempts
  WITH del AS (
    DELETE FROM public.exam_attempts
    WHERE member_id = _member_id
      AND tenant_id = v_tenant_id
      AND (
        (v_subject_ids IS NOT NULL AND subject_id = ANY(v_subject_ids))
        OR (v_training_types IS NOT NULL AND training_type = ANY(v_training_types))
      )
    RETURNING 1
  ) SELECT count(*) INTO v_del_attempts FROM del;

  -- 3) lecturer_ratings (member is the rater/student)
  WITH del AS (
    DELETE FROM public.lecturer_ratings
    WHERE member_id = _member_id
      AND tenant_id = v_tenant_id
      AND (_course_id IS NULL OR course_id = _course_id)
    RETURNING 1
  ) SELECT count(*) INTO v_del_ratings FROM del;

  -- 4) training_completions & certificates
  WITH del AS (
    DELETE FROM public.training_completions
    WHERE member_id = _member_id
      AND tenant_id = v_tenant_id
      AND training_type = ANY(v_training_types)
    RETURNING 1
  ) SELECT count(*) INTO v_del_completions FROM del;

  -- 5) course_registrations
  WITH del AS (
    DELETE FROM public.course_registrations
    WHERE member_id = _member_id
      AND tenant_id = v_tenant_id
      AND (_course_id IS NULL OR course_id = _course_id)
    RETURNING 1
  ) SELECT count(*) INTO v_del_registrations FROM del;

  -- 6) wofbi_applications
  WITH del AS (
    DELETE FROM public.wofbi_applications
    WHERE member_id = _member_id
      AND tenant_id = v_tenant_id
      AND (_course_id IS NULL OR course_id = _course_id)
    RETURNING 1
  ) SELECT count(*) INTO v_del_applications FROM del;

  -- Audit log
  INSERT INTO public.audit_log (user_id, tenant_id, action, entity_type, entity_id, details)
  VALUES (
    v_uid,
    v_tenant_id,
    'bible_school.cascade_delete',
    'members',
    _member_id,
    jsonb_build_object(
      'course_id', _course_id,
      'answers', v_del_answers,
      'attempts', v_del_attempts,
      'ratings', v_del_ratings,
      'completions', v_del_completions,
      'registrations', v_del_registrations,
      'applications', v_del_applications
    )
  );

  RETURN jsonb_build_object(
    'answers', v_del_answers,
    'attempts', v_del_attempts,
    'ratings', v_del_ratings,
    'completions', v_del_completions,
    'registrations', v_del_registrations,
    'applications', v_del_applications
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cascade_delete_bible_school_records(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cascade_delete_bible_school_records(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cascade_delete_bible_school_records(uuid, uuid) TO service_role;
