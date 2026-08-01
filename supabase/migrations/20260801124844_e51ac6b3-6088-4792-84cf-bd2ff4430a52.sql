CREATE TABLE public.wofbi_course_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.exam_titles(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.exam_sessions(id) ON DELETE SET NULL,
  title text,
  status text NOT NULL DEFAULT 'draft',
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX wofbi_course_reports_unique_scope
  ON public.wofbi_course_reports (tenant_id, course_id, COALESCE(session_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wofbi_course_reports TO authenticated;
GRANT ALL ON public.wofbi_course_reports TO service_role;

ALTER TABLE public.wofbi_course_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Course reports select"
ON public.wofbi_course_reports FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid(), tenant_id)
  OR public.is_tenant_admin(auth.uid(), tenant_id)
  OR public.is_reports_officer(auth.uid(), tenant_id)
);

CREATE POLICY "Course reports insert"
ON public.wofbi_course_reports FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin(auth.uid(), tenant_id)
  OR public.is_tenant_admin(auth.uid(), tenant_id)
);

CREATE POLICY "Course reports update"
ON public.wofbi_course_reports FOR UPDATE TO authenticated
USING (
  public.is_admin(auth.uid(), tenant_id)
  OR public.is_tenant_admin(auth.uid(), tenant_id)
)
WITH CHECK (
  public.is_admin(auth.uid(), tenant_id)
  OR public.is_tenant_admin(auth.uid(), tenant_id)
);

CREATE POLICY "Course reports delete"
ON public.wofbi_course_reports FOR DELETE TO authenticated
USING (
  public.is_admin(auth.uid(), tenant_id)
  OR public.is_tenant_admin(auth.uid(), tenant_id)
);

CREATE TRIGGER update_wofbi_course_reports_updated_at
BEFORE UPDATE ON public.wofbi_course_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();