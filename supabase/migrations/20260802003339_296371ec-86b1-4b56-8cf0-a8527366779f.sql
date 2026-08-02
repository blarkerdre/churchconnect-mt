ALTER TABLE public.wofbi_course_reports
  DROP CONSTRAINT wofbi_course_reports_session_id_fkey;

ALTER TABLE public.wofbi_course_reports
  ADD CONSTRAINT wofbi_course_reports_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES public.exam_sessions(id) ON DELETE CASCADE;