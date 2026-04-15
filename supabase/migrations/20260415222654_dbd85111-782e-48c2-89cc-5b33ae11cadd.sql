
DROP POLICY "Users can insert own feedback" ON public.app_feedback;
CREATE POLICY "Users can insert own feedback" ON public.app_feedback
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY "Users can update own feedback" ON public.app_feedback;
CREATE POLICY "Users can update own feedback" ON public.app_feedback
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY "Users can view own feedback" ON public.app_feedback;
CREATE POLICY "Users can view own feedback" ON public.app_feedback
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
