
CREATE TABLE public.lecturer_qc_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  lecturer_id uuid NOT NULL REFERENCES public.lecturers(id) ON DELETE CASCADE,
  exam_title_id uuid REFERENCES public.exam_titles(id) ON DELETE SET NULL,
  exam_subject_id uuid REFERENCES public.exam_subjects(id) ON DELETE SET NULL,
  check_date date NOT NULL DEFAULT CURRENT_DATE,
  tier text,
  qc_member_name text,
  started_on_time smallint,
  finished_on_time smallint,
  introduced_self boolean,
  orderliness_note text,
  orderliness_score smallint,
  content_focus_note text,
  content_focus_score smallint,
  conducted_test boolean,
  qa_observations text,
  general_observations text,
  class_recorded boolean,
  recording_submitted boolean,
  total_score smallint,
  student_avg_rating numeric(4,2),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lecturer_qc_checks_tenant ON public.lecturer_qc_checks(tenant_id);
CREATE INDEX idx_lecturer_qc_checks_lecturer ON public.lecturer_qc_checks(lecturer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lecturer_qc_checks TO authenticated;
GRANT ALL ON public.lecturer_qc_checks TO service_role;

ALTER TABLE public.lecturer_qc_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can view QC checks"
  ON public.lecturer_qc_checks FOR SELECT
  USING (
    user_has_tenant_access(tenant_id) AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM tenant_memberships tm
        WHERE tm.user_id = auth.uid()
          AND tm.tenant_id = lecturer_qc_checks.tenant_id
          AND tm.role = ANY (ARRAY['owner'::tenant_role, 'admin'::tenant_role])
      )
    )
  );

CREATE POLICY "Tenant admins can insert QC checks"
  ON public.lecturer_qc_checks FOR INSERT
  WITH CHECK (
    user_has_tenant_access(tenant_id) AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM tenant_memberships tm
        WHERE tm.user_id = auth.uid()
          AND tm.tenant_id = lecturer_qc_checks.tenant_id
          AND tm.role = ANY (ARRAY['owner'::tenant_role, 'admin'::tenant_role])
      )
    )
  );

CREATE POLICY "Tenant admins can update QC checks"
  ON public.lecturer_qc_checks FOR UPDATE
  USING (
    user_has_tenant_access(tenant_id) AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM tenant_memberships tm
        WHERE tm.user_id = auth.uid()
          AND tm.tenant_id = lecturer_qc_checks.tenant_id
          AND tm.role = ANY (ARRAY['owner'::tenant_role, 'admin'::tenant_role])
      )
    )
  );

CREATE POLICY "Tenant admins can delete QC checks"
  ON public.lecturer_qc_checks FOR DELETE
  USING (
    user_has_tenant_access(tenant_id) AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM tenant_memberships tm
        WHERE tm.user_id = auth.uid()
          AND tm.tenant_id = lecturer_qc_checks.tenant_id
          AND tm.role = ANY (ARRAY['owner'::tenant_role, 'admin'::tenant_role])
      )
    )
  );

CREATE TRIGGER update_lecturer_qc_checks_updated_at
  BEFORE UPDATE ON public.lecturer_qc_checks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
