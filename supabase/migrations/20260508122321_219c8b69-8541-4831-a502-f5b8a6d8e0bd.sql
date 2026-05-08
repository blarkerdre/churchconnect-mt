ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.exam_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.course_registrations DROP CONSTRAINT IF EXISTS course_registrations_member_id_course_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS course_registrations_member_course_session_uniq ON public.course_registrations (member_id, course_id, COALESCE(session_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS course_registrations_session_course_idx ON public.course_registrations (session_id, course_id);