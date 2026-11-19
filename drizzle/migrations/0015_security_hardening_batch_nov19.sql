-- 1. Profile auto-linking is only for trusted server code
REVOKE EXECUTE ON FUNCTION public.auto_link_member_by_email(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_link_member_by_email(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_link_member_by_email(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_link_member_by_email(uuid, text, uuid) TO service_role;

-- 2. Storage quota check only for people in that church
CREATE OR REPLACE FUNCTION public.check_tenant_storage_quota(_tenant_id uuid, _added_bytes bigint DEFAULT 0)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_limit_mb integer;
  v_used_mb numeric;
  v_added_mb numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.user_has_tenant_access(_tenant_id) OR public.has_role(auth.uid(), 'super_admin')) THEN
    RETURN false;
  END IF;
  SELECT storage_limit_mb INTO v_limit_mb FROM public.tenants WHERE id = _tenant_id;
  IF v_limit_mb IS NULL OR v_limit_mb <= 0 THEN
    RETURN true;
  END IF;
  v_used_mb := public.get_tenant_storage_usage_mb(_tenant_id);
  v_added_mb := COALESCE(_added_bytes, 0)::numeric / (1024 * 1024);
  RETURN (v_used_mb + v_added_mb) <= v_limit_mb;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.check_tenant_storage_quota(uuid, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_tenant_storage_quota(uuid, bigint) TO authenticated, service_role;

-- 3. Pending join-request count only for the signed-in user
CREATE OR REPLACE FUNCTION public.count_pending_join_requests_for_user(_user_id uuid, _tenant_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COUNT(*)::integer
  FROM public.unit_join_requests r
  WHERE _user_id = auth.uid()
    AND r.tenant_id = _tenant_id
    AND r.status = 'pending'
    AND (
      public.is_admin(_user_id, _tenant_id)
      OR (r.request_type = 'unit' AND public.is_unit_leader_for_session(_user_id, r.unit_name, _tenant_id))
      OR (r.request_type = 'home_cell' AND public.is_home_cell_leader_for_centre(_user_id, r.wsf_centre_id, _tenant_id))
    );
$function$;
REVOKE EXECUTE ON FUNCTION public.count_pending_join_requests_for_user(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_pending_join_requests_for_user(uuid, uuid) TO authenticated, service_role;

-- 4. Members can only self-register as pending
DROP POLICY IF EXISTS "Members can register for courses" ON public.course_registrations;
CREATE POLICY "Members can register for courses" ON public.course_registrations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.members m WHERE m.id = course_registrations.member_id AND m.user_id = auth.uid())
    AND public.user_has_tenant_access(tenant_id)
    AND coalesce(status, 'pending') = 'pending'
    AND approved_at IS NULL
    AND approved_by IS NULL
    AND student_number IS NULL
  );

-- 5. Server-recorded trivia start times
CREATE TABLE IF NOT EXISTS public.trivia_attempt_starts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  quiz_id uuid NOT NULL,
  player_key text NOT NULL,
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, player_key, user_id)
);
GRANT ALL ON public.trivia_attempt_starts TO service_role;
ALTER TABLE public.trivia_attempt_starts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.start_trivia_attempt(_tenant_id uuid, _quiz_id uuid, _player_kind text DEFAULT 'member', _child_id uuid DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_key text;
BEGIN
  IF auth.uid() IS NULL OR _tenant_id IS NULL OR NOT public.user_has_tenant_access(_tenant_id) THEN
    RAISE EXCEPTION 'NOT_AUTHORISED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.trivia_quizzes WHERE id = _quiz_id AND tenant_id = _tenant_id) THEN
    RAISE EXCEPTION 'QUIZ_NOT_FOUND';
  END IF;
  v_key := CASE
    WHEN _player_kind = 'teen' AND _child_id IS NOT NULL THEN 'teen:' || _child_id::text
    WHEN _player_kind = 'preteen' AND _child_id IS NOT NULL THEN 'preteen:' || _child_id::text
    ELSE 'member:' || auth.uid()::text END;
  INSERT INTO public.trivia_attempt_starts (tenant_id, quiz_id, player_key, user_id)
  VALUES (_tenant_id, _quiz_id, v_key, auth.uid())
  ON CONFLICT (quiz_id, player_key, user_id) DO NOTHING;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.start_trivia_attempt(uuid, uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_trivia_attempt(uuid, uuid, text, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.submit_trivia_attempt(_tenant_id uuid, _quiz_id uuid, _answers jsonb, _duration_seconds integer DEFAULT 0, _player_kind text DEFAULT 'member'::text, _child_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Europe/London')::date;
  v_kind text;
  v_player_key text;
  v_display text;
  v_attempt_id uuid;
  v_correct integer := 0;
  v_total integer := 0;
  v_score integer := 0;
  v_bonus integer := 0;
  v_rec record;
  v_sel integer;
  v_ok boolean;
  v_streak record;
  v_new_streak integer;
  v_results jsonb := '[]'::jsonb;
  v_elapsed integer;
BEGIN
  IF _tenant_id IS NULL OR NOT public.user_has_tenant_access(_tenant_id) THEN
    RAISE EXCEPTION 'NOT_AUTHORISED';
  END IF;

  SELECT kind INTO v_kind FROM public.trivia_quizzes WHERE id = _quiz_id AND tenant_id = _tenant_id;
  IF v_kind IS NULL THEN RAISE EXCEPTION 'QUIZ_NOT_FOUND'; END IF;

  IF _player_kind = 'teen' THEN
    SELECT t.first_name || ' ' || left(coalesce(t.last_name,''),1) INTO v_display
      FROM public.teens t JOIN public.members m ON m.id = t.primary_guardian_member_id
     WHERE t.id = _child_id AND t.tenant_id = _tenant_id AND m.user_id = auth.uid();
    IF v_display IS NULL THEN RAISE EXCEPTION 'NOT_GUARDIAN'; END IF;
    v_player_key := 'teen:' || _child_id::text;
  ELSIF _player_kind = 'preteen' THEN
    SELECT p.first_name || ' ' || left(coalesce(p.last_name,''),1) INTO v_display
      FROM public.preteens p JOIN public.members m ON m.id = p.primary_guardian_member_id
     WHERE p.id = _child_id AND p.tenant_id = _tenant_id AND m.user_id = auth.uid();
    IF v_display IS NULL THEN RAISE EXCEPTION 'NOT_GUARDIAN'; END IF;
    v_player_key := 'preteen:' || _child_id::text;
  ELSE
    _player_kind := 'member';
    SELECT m.first_name || ' ' || coalesce(m.last_name,'') INTO v_display
      FROM public.members m WHERE m.user_id = auth.uid() AND m.tenant_id = _tenant_id LIMIT 1;
    v_display := coalesce(v_display, 'Member');
    v_player_key := 'member:' || auth.uid()::text;
  END IF;

  IF EXISTS (SELECT 1 FROM public.trivia_attempts WHERE quiz_id = _quiz_id AND player_key = v_player_key) THEN
    RAISE EXCEPTION 'ALREADY_PLAYED';
  END IF;

  -- Elapsed time is measured on the server from when the quiz was opened; the caller's duration is ignored.
  SELECT greatest(floor(extract(epoch FROM (now() - s.started_at)))::integer, 0) INTO v_elapsed
    FROM public.trivia_attempt_starts s
   WHERE s.quiz_id = _quiz_id AND s.player_key = v_player_key AND s.user_id = auth.uid();

  INSERT INTO public.trivia_attempts (tenant_id, quiz_id, player_key, player_kind, user_id, teen_id, preteen_id, display_name, duration_seconds)
  VALUES (_tenant_id, _quiz_id, v_player_key, _player_kind, auth.uid(),
          CASE WHEN _player_kind = 'teen' THEN _child_id END,
          CASE WHEN _player_kind = 'preteen' THEN _child_id END,
          v_display, coalesce(v_elapsed, 0))
  RETURNING id INTO v_attempt_id;

  FOR v_rec IN
    SELECT q.id, q.correct_index, q.explanation, q.reference
      FROM public.trivia_quiz_questions qq
      JOIN public.trivia_questions q ON q.id = qq.question_id
     WHERE qq.quiz_id = _quiz_id
     ORDER BY qq.position
  LOOP
    v_total := v_total + 1;
    v_sel := NULLIF(_answers ->> v_rec.id::text, '')::integer;
    v_ok := v_sel IS NOT NULL AND v_sel = v_rec.correct_index;
    IF v_ok THEN v_correct := v_correct + 1; END IF;
    INSERT INTO public.trivia_answers (tenant_id, attempt_id, question_id, selected_index, is_correct)
    VALUES (_tenant_id, v_attempt_id, v_rec.id, v_sel, v_ok);
    v_results := v_results || jsonb_build_object(
      'question_id', v_rec.id,
      'selected_index', v_sel,
      'correct_index', v_rec.correct_index,
      'is_correct', v_ok,
      'reference', v_rec.reference,
      'explanation', v_rec.explanation
    );
  END LOOP;

  v_score := v_correct * 10;
  IF v_total > 0 AND v_elapsed IS NOT NULL AND v_elapsed > 0 AND v_elapsed < v_total * 15 THEN
    v_bonus := least(5 * v_correct, 25);
    v_score := v_score + v_bonus;
  END IF;

  UPDATE public.trivia_attempts
     SET score = v_score, correct_count = v_correct, total_count = v_total
   WHERE id = v_attempt_id;

  SELECT * INTO v_streak FROM public.trivia_streaks WHERE tenant_id = _tenant_id AND player_key = v_player_key;
  IF v_streak IS NULL THEN
    INSERT INTO public.trivia_streaks (tenant_id, player_key, player_kind, user_id, teen_id, preteen_id, display_name, current_streak, longest_streak, last_played_on, total_points)
    VALUES (_tenant_id, v_player_key, _player_kind, auth.uid(),
            CASE WHEN _player_kind = 'teen' THEN _child_id END,
            CASE WHEN _player_kind = 'preteen' THEN _child_id END,
            v_display, CASE WHEN v_kind = 'daily' THEN 1 ELSE 0 END,
            CASE WHEN v_kind = 'daily' THEN 1 ELSE 0 END,
            CASE WHEN v_kind = 'daily' THEN v_today END, v_score);
    v_new_streak := CASE WHEN v_kind = 'daily' THEN 1 ELSE 0 END;
  ELSE
    IF v_kind = 'daily' THEN
      IF v_streak.last_played_on = v_today THEN
        v_new_streak := v_streak.current_streak;
      ELSIF v_streak.last_played_on = v_today - 1 THEN
        v_new_streak := v_streak.current_streak + 1;
      ELSE
        v_new_streak := 1;
      END IF;
    ELSE
      v_new_streak := v_streak.current_streak;
    END IF;
    UPDATE public.trivia_streaks
       SET current_streak = v_new_streak,
           longest_streak = greatest(longest_streak, v_new_streak),
           last_played_on = CASE WHEN v_kind = 'daily' THEN v_today ELSE last_played_on END,
           total_points = total_points + v_score,
           display_name = v_display
     WHERE tenant_id = _tenant_id AND player_key = v_player_key;
  END IF;

  RETURN jsonb_build_object(
    'attempt_id', v_attempt_id,
    'score', v_score,
    'bonus', v_bonus,
    'correct_count', v_correct,
    'total_count', v_total,
    'current_streak', v_new_streak,
    'results', v_results
  );
END;
$function$;