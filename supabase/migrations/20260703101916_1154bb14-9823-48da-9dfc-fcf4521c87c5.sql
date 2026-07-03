CREATE TABLE public.user_tour_completions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tour_id text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tour_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_tour_completions TO authenticated;
GRANT ALL ON public.user_tour_completions TO service_role;
ALTER TABLE public.user_tour_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rows read" ON public.user_tour_completions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own rows insert" ON public.user_tour_completions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own rows update" ON public.user_tour_completions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own rows delete" ON public.user_tour_completions FOR DELETE TO authenticated USING (user_id = auth.uid());