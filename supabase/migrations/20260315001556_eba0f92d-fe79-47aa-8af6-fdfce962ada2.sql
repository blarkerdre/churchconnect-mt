
CREATE TABLE public.church_attendance_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_date date NOT NULL,
  service_type text NOT NULL DEFAULT 'Sunday Service',
  title text,
  adult_male integer NOT NULL DEFAULT 0,
  adult_female integer NOT NULL DEFAULT 0,
  children integer NOT NULL DEFAULT 0,
  teens integer NOT NULL DEFAULT 0,
  total_attendance integer NOT NULL DEFAULT 0,
  notes text,
  recorded_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.church_attendance_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can manage church attendance reports"
ON public.church_attendance_reports
FOR ALL
TO authenticated
USING (
  is_admin(auth.uid()) OR (
    EXISTS (
      SELECT 1 FROM unit_leader_assignments ula
      WHERE ula.user_id = auth.uid()
      AND ula.unit_name = ANY(ARRAY['Pastoral Care','pastoral care','Altar Minister','altar minister','Altar Ministers','altar ministers'])
    )
  )
)
WITH CHECK (
  is_admin(auth.uid()) OR (
    EXISTS (
      SELECT 1 FROM unit_leader_assignments ula
      WHERE ula.user_id = auth.uid()
      AND ula.unit_name = ANY(ARRAY['Pastoral Care','pastoral care','Altar Minister','altar minister','Altar Ministers','altar ministers'])
    )
  )
);

CREATE POLICY "Authorized users can view church attendance reports"
ON public.church_attendance_reports
FOR SELECT
TO authenticated
USING (
  is_admin(auth.uid()) OR (
    EXISTS (
      SELECT 1 FROM unit_leader_assignments ula
      WHERE ula.user_id = auth.uid()
      AND ula.unit_name = ANY(ARRAY['Pastoral Care','pastoral care','Altar Minister','altar minister','Altar Ministers','altar ministers'])
    )
  )
);
