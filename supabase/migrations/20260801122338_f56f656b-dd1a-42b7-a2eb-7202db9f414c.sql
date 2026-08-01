CREATE TABLE public.wofbi_feedback_forms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  title TEXT NOT NULL DEFAULT 'Bible School — Feedback Form',
  intro_text TEXT,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wofbi_feedback_forms TO authenticated;
GRANT ALL ON public.wofbi_feedback_forms TO service_role;
ALTER TABLE public.wofbi_feedback_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Feedback form readable by tenant users"
ON public.wofbi_feedback_forms FOR SELECT TO authenticated
USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Feedback form managed by admins"
ON public.wofbi_feedback_forms FOR ALL TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.wofbi_feedback_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  registration_id UUID REFERENCES public.course_registrations(id) ON DELETE CASCADE,
  course_id UUID,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (registration_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wofbi_feedback_responses TO authenticated;
GRANT ALL ON public.wofbi_feedback_responses TO service_role;
ALTER TABLE public.wofbi_feedback_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students insert own feedback"
ON public.wofbi_feedback_responses FOR INSERT TO authenticated
WITH CHECK (
  public.user_has_tenant_access(tenant_id)
  AND member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid() AND members.tenant_id = wofbi_feedback_responses.tenant_id)
);

CREATE POLICY "Students read own feedback"
ON public.wofbi_feedback_responses FOR SELECT TO authenticated
USING (
  member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid() AND members.tenant_id = wofbi_feedback_responses.tenant_id)
  OR public.is_tenant_admin(auth.uid(), tenant_id)
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.is_reports_officer(auth.uid(), tenant_id)
);

CREATE POLICY "Admins delete feedback"
ON public.wofbi_feedback_responses FOR DELETE TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_wofbi_feedback_forms_updated_at
BEFORE UPDATE ON public.wofbi_feedback_forms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_wofbi_feedback_responses_updated_at
BEFORE UPDATE ON public.wofbi_feedback_responses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();