
-- Training/programme session reports table
CREATE TABLE public.training_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_type text NOT NULL, -- e.g. 'Water Baptism', 'Holy Spirit Baptism', 'BFC', 'BCC', 'LCC', 'LDC', 'WIT'
  session_date date NOT NULL,
  title text,
  total_attendance integer NOT NULL DEFAULT 0,
  male integer NOT NULL DEFAULT 0,
  female integer NOT NULL DEFAULT 0,
  holy_ghost_baptism integer NOT NULL DEFAULT 0,
  water_baptism integer NOT NULL DEFAULT 0,
  notes text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.training_reports ENABLE ROW LEVEL SECURITY;

-- View: super_admin, admin, pastoral care unit, altar minister unit
CREATE POLICY "Authorized users can view training reports"
ON public.training_reports FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.unit_leader_assignments ula
    WHERE ula.user_id = auth.uid()
    AND ula.unit_name IN ('Pastoral Care', 'pastoral care', 'Altar Minister', 'altar minister', 'Altar Ministers', 'altar ministers')
  )
);

-- Manage: same roles
CREATE POLICY "Authorized users can manage training reports"
ON public.training_reports FOR ALL TO authenticated
USING (
  is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.unit_leader_assignments ula
    WHERE ula.user_id = auth.uid()
    AND ula.unit_name IN ('Pastoral Care', 'pastoral care', 'Altar Minister', 'altar minister', 'Altar Ministers', 'altar ministers')
  )
)
WITH CHECK (
  is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.unit_leader_assignments ula
    WHERE ula.user_id = auth.uid()
    AND ula.unit_name IN ('Pastoral Care', 'pastoral care', 'Altar Minister', 'altar minister', 'Altar Ministers', 'altar ministers')
  )
);

-- Updated_at trigger
CREATE TRIGGER set_training_reports_updated_at
  BEFORE UPDATE ON public.training_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
