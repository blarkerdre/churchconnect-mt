
-- ============ TABLES ============

CREATE TABLE public.trivia_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  prompt text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_index integer NOT NULL DEFAULT 0,
  reference text,
  explanation text,
  difficulty text NOT NULL DEFAULT 'medium',
  source text NOT NULL DEFAULT 'admin',
  audience text NOT NULL DEFAULT 'all',
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trivia_questions TO authenticated;
GRANT ALL ON public.trivia_questions TO service_role;
ALTER TABLE public.trivia_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trivia_questions_admin_read" ON public.trivia_questions FOR SELECT TO authenticated USING (is_admin(auth.uid(), tenant_id));
CREATE POLICY "trivia_questions_admin_insert" ON public.trivia_questions FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid(), tenant_id));
CREATE POLICY "trivia_questions_admin_update" ON public.trivia_questions FOR UPDATE TO authenticated USING (is_admin(auth.uid(), tenant_id)) WITH CHECK (is_admin(auth.uid(), tenant_id));
CREATE POLICY "trivia_questions_admin_delete" ON public.trivia_questions FOR DELETE TO authenticated USING (is_admin(auth.uid(), tenant_id));
CREATE POLICY "Require completed two-step verification" ON public.trivia_questions AS RESTRICTIVE FOR ALL TO authenticated USING (mfa_satisfied()) WITH CHECK (mfa_satisfied());

CREATE TABLE public.trivia_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'daily',
  title text,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  audience text NOT NULL DEFAULT 'all',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, kind, starts_on)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trivia_quizzes TO authenticated;
GRANT ALL ON public.trivia_quizzes TO service_role;
ALTER TABLE public.trivia_quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trivia_quizzes_read" ON public.trivia_quizzes FOR SELECT TO authenticated USING (user_has_tenant_access(tenant_id));
CREATE POLICY "trivia_quizzes_admin_write" ON public.trivia_quizzes FOR ALL TO authenticated USING (is_admin(auth.uid(), tenant_id)) WITH CHECK (is_admin(auth.uid(), tenant_id));
CREATE POLICY "Require completed two-step verification" ON public.trivia_quizzes AS RESTRICTIVE FOR ALL TO authenticated USING (mfa_satisfied()) WITH CHECK (mfa_satisfied());

CREATE TABLE public.trivia_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  quiz_id uuid NOT NULL REFERENCES public.trivia_quizzes(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.trivia_questions(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, question_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trivia_quiz_questions TO authenticated;
GRANT ALL ON public.trivia_quiz_questions TO service_role;
ALTER TABLE public.trivia_quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trivia_quiz_questions_admin_all" ON public.trivia_quiz_questions FOR ALL TO authenticated USING (is_admin(auth.uid(), tenant_id)) WITH CHECK (is_admin(auth.uid(), tenant_id));
CREATE POLICY "Require completed two-step verification" ON public.trivia_quiz_questions AS RESTRICTIVE FOR ALL TO authenticated USING (mfa_satisfied()) WITH CHECK (mfa_satisfied());

CREATE TABLE public.trivia_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  quiz_id uuid NOT NULL REFERENCES public.trivia_quizzes(id) ON DELETE CASCADE,
  player_key text NOT NULL,
  player_kind text NOT NULL DEFAULT 'member',
  user_id uuid,
  teen_id uuid,
  preteen_id uuid,
  display_name text,
  score integer NOT NULL DEFAULT 0,
  correct_count integer NOT NULL DEFAULT 0,
  total_count integer NOT NULL DEFAULT 0,
  duration_seconds integer NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, player_key)
);
GRANT SELECT ON public.trivia_attempts TO authenticated;
GRANT ALL ON public.trivia_attempts TO service_role;
ALTER TABLE public.trivia_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trivia_attempts_read_own" ON public.trivia_attempts FOR SELECT TO authenticated USING (
  is_admin(auth.uid(), tenant_id)
  OR user_id = auth.uid()
  OR (teen_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.teens t JOIN public.members m ON m.id = t.primary_guardian_member_id WHERE t.id = trivia_attempts.teen_id AND m.user_id = auth.uid()))
  OR (preteen_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.preteens p JOIN public.members m ON m.id = p.primary_guardian_member_id WHERE p.id = trivia_attempts.preteen_id AND m.user_id = auth.uid()))
);
CREATE POLICY "Require completed two-step verification" ON public.trivia_attempts AS RESTRICTIVE FOR ALL TO authenticated USING (mfa_satisfied()) WITH CHECK (mfa_satisfied());

CREATE TABLE public.trivia_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  attempt_id uuid NOT NULL REFERENCES public.trivia_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.trivia_questions(id) ON DELETE CASCADE,
  selected_index integer,
  is_correct boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.trivia_answers TO authenticated;
GRANT ALL ON public.trivia_answers TO service_role;
ALTER TABLE public.trivia_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trivia_answers_read_own" ON public.trivia_answers FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.trivia_attempts a WHERE a.id = trivia_answers.attempt_id AND (a.user_id = auth.uid() OR is_admin(auth.uid(), a.tenant_id)))
);
CREATE POLICY "Require completed two-step verification" ON public.trivia_answers AS RESTRICTIVE FOR ALL TO authenticated USING (mfa_satisfied()) WITH CHECK (mfa_satisfied());

CREATE TABLE public.trivia_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  player_key text NOT NULL,
  player_kind text NOT NULL DEFAULT 'member',
  user_id uuid,
  teen_id uuid,
  preteen_id uuid,
  display_name text,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_played_on date,
  total_points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, player_key)
);
GRANT SELECT ON public.trivia_streaks TO authenticated;
GRANT ALL ON public.trivia_streaks TO service_role;
ALTER TABLE public.trivia_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trivia_streaks_read_tenant" ON public.trivia_streaks FOR SELECT TO authenticated USING (user_has_tenant_access(tenant_id));
CREATE POLICY "Require completed two-step verification" ON public.trivia_streaks AS RESTRICTIVE FOR ALL TO authenticated USING (mfa_satisfied()) WITH CHECK (mfa_satisfied());

CREATE TRIGGER update_trivia_questions_updated_at BEFORE UPDATE ON public.trivia_questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_trivia_quizzes_updated_at BEFORE UPDATE ON public.trivia_quizzes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_trivia_streaks_updated_at BEFORE UPDATE ON public.trivia_streaks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_trivia_questions_tenant_active ON public.trivia_questions(tenant_id, active);
CREATE INDEX idx_trivia_quizzes_tenant_dates ON public.trivia_quizzes(tenant_id, kind, starts_on DESC);
CREATE INDEX idx_trivia_attempts_tenant_completed ON public.trivia_attempts(tenant_id, completed_at DESC);
CREATE INDEX idx_trivia_streaks_tenant_points ON public.trivia_streaks(tenant_id, total_points DESC);

-- ============ FUNCTIONS ============

-- Ensure today's daily quiz and this week's weekly quiz exist for a tenant.
CREATE OR REPLACE FUNCTION public.ensure_trivia_quizzes(_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Europe/London')::date;
  v_week_start date := date_trunc('week', (now() AT TIME ZONE 'Europe/London'))::date;
  v_quiz_id uuid;
  v_count integer;
BEGIN
  IF _tenant_id IS NULL OR NOT public.user_has_tenant_access(_tenant_id) THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_count FROM public.trivia_questions WHERE tenant_id = _tenant_id AND active;
  IF v_count < 3 THEN RETURN; END IF;

  -- Daily
  SELECT id INTO v_quiz_id FROM public.trivia_quizzes
   WHERE tenant_id = _tenant_id AND kind = 'daily' AND starts_on = v_today;
  IF v_quiz_id IS NULL THEN
    INSERT INTO public.trivia_quizzes (tenant_id, kind, title, starts_on, ends_on)
    VALUES (_tenant_id, 'daily', 'Daily Bible Trivia', v_today, v_today)
    ON CONFLICT (tenant_id, kind, starts_on) DO NOTHING
    RETURNING id INTO v_quiz_id;

    IF v_quiz_id IS NOT NULL THEN
      INSERT INTO public.trivia_quiz_questions (tenant_id, quiz_id, question_id, position)
      SELECT _tenant_id, v_quiz_id, q.id, row_number() OVER ()
      FROM (
        SELECT id FROM public.trivia_questions
         WHERE tenant_id = _tenant_id AND active
         ORDER BY md5(id::text || v_today::text)
         LIMIT 5
      ) q;
    END IF;
  END IF;

  -- Weekly
  SELECT id INTO v_quiz_id FROM public.trivia_quizzes
   WHERE tenant_id = _tenant_id AND kind = 'weekly' AND starts_on = v_week_start;
  IF v_quiz_id IS NULL THEN
    INSERT INTO public.trivia_quizzes (tenant_id, kind, title, starts_on, ends_on)
    VALUES (_tenant_id, 'weekly', 'Weekly Bible Challenge', v_week_start, v_week_start + 6)
    ON CONFLICT (tenant_id, kind, starts_on) DO NOTHING
    RETURNING id INTO v_quiz_id;

    IF v_quiz_id IS NOT NULL THEN
      INSERT INTO public.trivia_quiz_questions (tenant_id, quiz_id, question_id, position)
      SELECT _tenant_id, v_quiz_id, q.id, row_number() OVER ()
      FROM (
        SELECT id FROM public.trivia_questions
         WHERE tenant_id = _tenant_id AND active
         ORDER BY md5(id::text || v_week_start::text || 'w')
         LIMIT 15
      ) q;
    END IF;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.ensure_trivia_quizzes(uuid) TO authenticated;

-- Serve quiz questions WITHOUT the answer key.
CREATE OR REPLACE FUNCTION public.get_trivia_quiz_safe(_tenant_id uuid, _quiz_id uuid)
RETURNS TABLE (question_id uuid, q_position integer, prompt text, options jsonb, reference text, difficulty text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.id, qq.position, q.prompt, q.options, q.reference, q.difficulty
  FROM public.trivia_quiz_questions qq
  JOIN public.trivia_questions q ON q.id = qq.question_id
  JOIN public.trivia_quizzes z ON z.id = qq.quiz_id
  WHERE qq.quiz_id = _quiz_id
    AND z.tenant_id = _tenant_id
    AND public.user_has_tenant_access(_tenant_id)
  ORDER BY qq.position;
$$;
GRANT EXECUTE ON FUNCTION public.get_trivia_quiz_safe(uuid, uuid) TO authenticated;

-- Grade and record an attempt; updates streaks and points.
CREATE OR REPLACE FUNCTION public.submit_trivia_attempt(
  _tenant_id uuid,
  _quiz_id uuid,
  _answers jsonb,
  _duration_seconds integer DEFAULT 0,
  _player_kind text DEFAULT 'member',
  _child_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  INSERT INTO public.trivia_attempts (tenant_id, quiz_id, player_key, player_kind, user_id, teen_id, preteen_id, display_name, duration_seconds)
  VALUES (_tenant_id, _quiz_id, v_player_key, _player_kind, auth.uid(),
          CASE WHEN _player_kind = 'teen' THEN _child_id END,
          CASE WHEN _player_kind = 'preteen' THEN _child_id END,
          v_display, greatest(coalesce(_duration_seconds,0), 0))
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
  IF v_total > 0 AND _duration_seconds > 0 AND _duration_seconds < v_total * 15 THEN
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
$$;
GRANT EXECUTE ON FUNCTION public.submit_trivia_attempt(uuid, uuid, jsonb, integer, text, uuid) TO authenticated;

-- Leaderboard, tenant scoped.
CREATE OR REPLACE FUNCTION public.get_trivia_leaderboard(
  _tenant_id uuid,
  _scope text DEFAULT 'all',
  _audience text DEFAULT 'adult',
  _limit integer DEFAULT 20
)
RETURNS TABLE (player_key text, display_name text, player_kind text, points bigint, plays bigint, current_streak integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz;
BEGIN
  IF _tenant_id IS NULL OR NOT public.user_has_tenant_access(_tenant_id) THEN RETURN; END IF;
  v_since := CASE
    WHEN _scope = 'week' THEN date_trunc('week', now())
    WHEN _scope = 'month' THEN date_trunc('month', now())
    ELSE '-infinity'::timestamptz END;

  RETURN QUERY
  SELECT a.player_key,
         max(coalesce(s.display_name, a.display_name)) AS display_name,
         max(a.player_kind) AS player_kind,
         sum(a.score)::bigint AS points,
         count(*)::bigint AS plays,
         coalesce(max(s.current_streak), 0) AS current_streak
    FROM public.trivia_attempts a
    LEFT JOIN public.trivia_streaks s ON s.tenant_id = a.tenant_id AND s.player_key = a.player_key
   WHERE a.tenant_id = _tenant_id
     AND a.completed_at >= v_since
     AND ((_audience = 'youth' AND a.player_kind IN ('teen','preteen'))
          OR (_audience <> 'youth' AND a.player_kind = 'member'))
   GROUP BY a.player_key
   ORDER BY points DESC, plays ASC
   LIMIT greatest(coalesce(_limit, 20), 1);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_trivia_leaderboard(uuid, text, text, integer) TO authenticated;
