
-- Add registration and exam window controls to exam_titles
ALTER TABLE public.exam_titles
  ADD COLUMN registration_open BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN exams_open BOOLEAN NOT NULL DEFAULT false;

-- Create course_registrations table
CREATE TABLE public.course_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL,
  course_id UUID NOT NULL REFERENCES public.exam_titles(id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id, course_id)
);

ALTER TABLE public.course_registrations ENABLE ROW LEVEL SECURITY;

-- Members can view own registrations
CREATE POLICY "Members can view own registrations" ON public.course_registrations
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM members m WHERE m.id = course_registrations.member_id AND m.user_id = auth.uid()));

-- Members can insert own registrations
CREATE POLICY "Members can register for courses" ON public.course_registrations
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM members m WHERE m.id = course_registrations.member_id AND m.user_id = auth.uid()));

-- Admins can manage all registrations
CREATE POLICY "Admins can manage registrations" ON public.course_registrations
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
