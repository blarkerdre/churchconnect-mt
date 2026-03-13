
CREATE TABLE public.wsf_attendance_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid NOT NULL REFERENCES public.wsf_centres(id) ON DELETE CASCADE,
  meeting_date date NOT NULL,
  male integer NOT NULL DEFAULT 0,
  female integer NOT NULL DEFAULT 0,
  children integer NOT NULL DEFAULT 0,
  first_timers integer NOT NULL DEFAULT 0,
  testimonies integer NOT NULL DEFAULT 0,
  notes text,
  reported_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(centre_id, meeting_date)
);

ALTER TABLE public.wsf_attendance_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/leaders can manage wsf reports"
ON public.wsf_attendance_reports FOR ALL TO authenticated
USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role))
WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role));

CREATE POLICY "WSF leaders can manage own centre reports"
ON public.wsf_attendance_reports FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.wsf_centres wc
    JOIN public.members m ON m.id = wc.leader_id
    WHERE wc.id = wsf_attendance_reports.centre_id
    AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.wsf_centres wc
    JOIN public.members m ON m.id = wc.leader_id
    WHERE wc.id = wsf_attendance_reports.centre_id
    AND m.user_id = auth.uid()
  )
);

CREATE POLICY "Authenticated can view wsf reports"
ON public.wsf_attendance_reports FOR SELECT TO authenticated
USING (true);
