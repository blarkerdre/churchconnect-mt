DROP POLICY IF EXISTS "Tenant admins can manage memberships" ON public.tenant_memberships;

CREATE POLICY "Tenant owners can manage memberships"
ON public.tenant_memberships FOR ALL TO authenticated
USING (public.is_tenant_owner(auth.uid(), tenant_id))
WITH CHECK (public.is_tenant_owner(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can add members"
ON public.tenant_memberships FOR INSERT TO authenticated
WITH CHECK (
  public.is_tenant_admin(auth.uid(), tenant_id)
  AND role = 'member'::tenant_role
  AND user_id <> auth.uid()
);

CREATE POLICY "Tenant admins can update member rows"
ON public.tenant_memberships FOR UPDATE TO authenticated
USING (
  public.is_tenant_admin(auth.uid(), tenant_id)
  AND role = 'member'::tenant_role
  AND user_id <> auth.uid()
)
WITH CHECK (
  public.is_tenant_admin(auth.uid(), tenant_id)
  AND role = 'member'::tenant_role
  AND user_id <> auth.uid()
);

CREATE POLICY "Tenant admins can remove members"
ON public.tenant_memberships FOR DELETE TO authenticated
USING (
  public.is_tenant_admin(auth.uid(), tenant_id)
  AND role = 'member'::tenant_role
  AND user_id <> auth.uid()
);

CREATE OR REPLACE FUNCTION public.clone_exam_subjects_to_session(p_tenant_id uuid, p_course_id uuid, p_from_session uuid, p_to_session uuid, p_include_questions boolean DEFAULT true)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_subjects int := 0; v_questions int := 0; r record; q record; v_new_id uuid; v_qid uuid;
BEGIN
  IF NOT (public.is_tenant_admin(auth.uid(), p_tenant_id) OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  IF p_to_session IS NULL THEN RAISE EXCEPTION 'Target edition is required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.exam_sessions s WHERE s.id = p_to_session AND s.tenant_id = p_tenant_id) THEN
    RAISE EXCEPTION 'Target edition does not belong to this church';
  END IF;
  IF p_from_session IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.exam_sessions s WHERE s.id = p_from_session AND s.tenant_id = p_tenant_id) THEN
    RAISE EXCEPTION 'Source edition does not belong to this church';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.exam_titles t WHERE t.id = p_course_id AND t.tenant_id = p_tenant_id) THEN
    RAISE EXCEPTION 'Course does not belong to this church';
  END IF;

  FOR r IN SELECT * FROM public.exam_subjects
    WHERE tenant_id = p_tenant_id AND course_id = p_course_id AND session_id IS NOT DISTINCT FROM p_from_session
    ORDER BY sort_order, created_at
  LOOP
    IF EXISTS (SELECT 1 FROM public.exam_subjects WHERE tenant_id = p_tenant_id AND course_id = p_course_id AND session_id = p_to_session AND name = r.name) THEN
      CONTINUE;
    END IF;
    INSERT INTO public.exam_subjects (tenant_id, course_id, session_id, name, code, description, lecturer_id,
      pass_mark_percentage, time_limit_minutes, randomize_questions, grade_classifications, sort_order, is_active, is_open)
    VALUES (p_tenant_id, p_course_id, p_to_session, r.name, r.code, r.description, r.lecturer_id,
      r.pass_mark_percentage, r.time_limit_minutes, r.randomize_questions, r.grade_classifications, r.sort_order, r.is_active, false)
    RETURNING id INTO v_new_id;
    v_subjects := v_subjects + 1;

    IF p_include_questions THEN
      FOR q IN SELECT * FROM public.exam_questions WHERE subject_id = r.id AND tenant_id = p_tenant_id ORDER BY sort_order, created_at LOOP
        INSERT INTO public.exam_questions (tenant_id, subject_id, session_id, training_type, question_text,
          option_a, option_b, option_c, option_d, points, sort_order, answer_count, question_type, created_by)
        VALUES (p_tenant_id, v_new_id, p_to_session, q.training_type, q.question_text,
          q.option_a, q.option_b, q.option_c, q.option_d, q.points, q.sort_order, q.answer_count, q.question_type, auth.uid())
        RETURNING id INTO v_qid;
        INSERT INTO public.exam_question_answers (question_id, correct_answer, tenant_id)
        SELECT v_qid, a.correct_answer, p_tenant_id FROM public.exam_question_answers a WHERE a.question_id = q.id;
        v_questions := v_questions + 1;
      END LOOP;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('subjects', v_subjects, 'questions', v_questions);
END;
$function$;