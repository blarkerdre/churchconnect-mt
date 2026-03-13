
CREATE TABLE public.unit_leader_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  unit_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, unit_name)
);

ALTER TABLE public.unit_leader_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage unit leader assignments"
  ON public.unit_leader_assignments
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Users can view own assignments"
  ON public.unit_leader_assignments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
