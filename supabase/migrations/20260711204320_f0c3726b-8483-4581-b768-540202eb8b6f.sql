
-- Application form configuration (one per tenant)
CREATE TABLE public.wofbi_application_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  title text NOT NULL DEFAULT 'Bible School — Application Form',
  intro_text text,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wofbi_application_forms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wofbi_application_forms TO authenticated;
GRANT ALL ON public.wofbi_application_forms TO service_role;

ALTER TABLE public.wofbi_application_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view application form config"
  ON public.wofbi_application_forms FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Tenant admins can insert application form"
  ON public.wofbi_application_forms FOR INSERT
  TO authenticated
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Tenant admins can update application form"
  ON public.wofbi_application_forms FOR UPDATE
  TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Tenant admins can delete application form"
  ON public.wofbi_application_forms FOR DELETE
  TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_wofbi_application_forms_updated_at
  BEFORE UPDATE ON public.wofbi_application_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Applications (submissions)
CREATE TABLE public.wofbi_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.exam_titles(id) ON DELETE SET NULL,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'submitted',
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wofbi_applications_tenant ON public.wofbi_applications(tenant_id);
CREATE INDEX idx_wofbi_applications_course ON public.wofbi_applications(course_id);
CREATE INDEX idx_wofbi_applications_member ON public.wofbi_applications(member_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wofbi_applications TO authenticated;
GRANT ALL ON public.wofbi_applications TO service_role;

ALTER TABLE public.wofbi_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can view applications"
  ON public.wofbi_applications FOR SELECT
  TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Applicant member can view own application"
  ON public.wofbi_applications FOR SELECT
  TO authenticated
  USING (
    member_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = wofbi_applications.member_id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant admins can update applications"
  ON public.wofbi_applications FOR UPDATE
  TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Tenant admins can delete applications"
  ON public.wofbi_applications FOR DELETE
  TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_wofbi_applications_updated_at
  BEFORE UPDATE ON public.wofbi_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
