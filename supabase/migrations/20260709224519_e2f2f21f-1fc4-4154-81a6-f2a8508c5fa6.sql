
-- Lecturers table
CREATE TABLE public.lecturers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  level text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lecturers_tenant ON public.lecturers(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lecturers TO authenticated;
GRANT ALL ON public.lecturers TO service_role;

ALTER TABLE public.lecturers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view lecturers"
  ON public.lecturers FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant admins can insert lecturers"
  ON public.lecturers FOR INSERT TO authenticated
  WITH CHECK (
    public.user_has_tenant_access(tenant_id) AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.tenant_memberships tm
        WHERE tm.user_id = auth.uid() AND tm.tenant_id = lecturers.tenant_id
          AND tm.role IN ('owner','admin')
      )
    )
  );

CREATE POLICY "Tenant admins can update lecturers"
  ON public.lecturers FOR UPDATE TO authenticated
  USING (
    public.user_has_tenant_access(tenant_id) AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.tenant_memberships tm
        WHERE tm.user_id = auth.uid() AND tm.tenant_id = lecturers.tenant_id
          AND tm.role IN ('owner','admin')
      )
    )
  );

CREATE POLICY "Tenant admins can delete lecturers"
  ON public.lecturers FOR DELETE TO authenticated
  USING (
    public.user_has_tenant_access(tenant_id) AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.tenant_memberships tm
        WHERE tm.user_id = auth.uid() AND tm.tenant_id = lecturers.tenant_id
          AND tm.role IN ('owner','admin')
      )
    )
  );

CREATE TRIGGER update_lecturers_updated_at
  BEFORE UPDATE ON public.lecturers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lecturer ratings table
CREATE TABLE public.lecturer_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lecturer_id uuid NOT NULL REFERENCES public.lecturers(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  submitted_by uuid NOT NULL,
  level text,
  session_description text,
  delivery text,
  time_keeping text,
  class_atmosphere text,
  test_quality text,
  have_again text,
  overall_rating int CHECK (overall_rating BETWEEN 1 AND 10),
  comments text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, lecturer_id, submitted_by)
);

CREATE INDEX idx_lecturer_ratings_tenant ON public.lecturer_ratings(tenant_id);
CREATE INDEX idx_lecturer_ratings_lecturer ON public.lecturer_ratings(lecturer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lecturer_ratings TO authenticated;
GRANT ALL ON public.lecturer_ratings TO service_role;

ALTER TABLE public.lecturer_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own ratings"
  ON public.lecturer_ratings FOR SELECT TO authenticated
  USING (submitted_by = auth.uid() AND public.user_has_tenant_access(tenant_id));

CREATE POLICY "Admins can view all tenant ratings"
  ON public.lecturer_ratings FOR SELECT TO authenticated
  USING (
    public.user_has_tenant_access(tenant_id) AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.tenant_memberships tm
        WHERE tm.user_id = auth.uid() AND tm.tenant_id = lecturer_ratings.tenant_id
          AND tm.role IN ('owner','admin')
      )
    )
  );

CREATE POLICY "Students can insert own rating"
  ON public.lecturer_ratings FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid() AND public.user_has_tenant_access(tenant_id));

CREATE POLICY "Students can update own rating"
  ON public.lecturer_ratings FOR UPDATE TO authenticated
  USING (submitted_by = auth.uid() AND public.user_has_tenant_access(tenant_id))
  WITH CHECK (submitted_by = auth.uid() AND public.user_has_tenant_access(tenant_id));

CREATE POLICY "Students can delete own rating"
  ON public.lecturer_ratings FOR DELETE TO authenticated
  USING (submitted_by = auth.uid() AND public.user_has_tenant_access(tenant_id));

CREATE TRIGGER update_lecturer_ratings_updated_at
  BEFORE UPDATE ON public.lecturer_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
