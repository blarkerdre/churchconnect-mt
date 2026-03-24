
-- Batch C: Training/exam tables

ALTER TABLE public.exam_titles ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_exam_titles_tenant_id ON public.exam_titles(tenant_id);

ALTER TABLE public.exam_subjects ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_exam_subjects_tenant_id ON public.exam_subjects(tenant_id);

ALTER TABLE public.exam_questions ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_exam_questions_tenant_id ON public.exam_questions(tenant_id);

ALTER TABLE public.exam_sessions ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_exam_sessions_tenant_id ON public.exam_sessions(tenant_id);

ALTER TABLE public.exam_session_courses ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_exam_session_courses_tenant_id ON public.exam_session_courses(tenant_id);

ALTER TABLE public.exam_attempts ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_exam_attempts_tenant_id ON public.exam_attempts(tenant_id);

ALTER TABLE public.exam_answers ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_exam_answers_tenant_id ON public.exam_answers(tenant_id);

ALTER TABLE public.course_registrations ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_course_registrations_tenant_id ON public.course_registrations(tenant_id);

ALTER TABLE public.certificate_templates ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_certificate_templates_tenant_id ON public.certificate_templates(tenant_id);

-- Backfill
UPDATE public.exam_titles SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.exam_subjects SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.exam_questions SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.exam_sessions SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.exam_session_courses SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.exam_attempts SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.exam_answers SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.course_registrations SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.certificate_templates SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
