-- Drop session-aware unique index
DROP INDEX IF EXISTS public.course_registrations_member_course_session_uniq;

-- Dedupe: keep the most recent registration per (member, course)
DELETE FROM public.course_registrations a
USING public.course_registrations b
WHERE a.member_id = b.member_id
  AND a.course_id = b.course_id
  AND a.id <> b.id
  AND (a.registered_at, a.id) < (b.registered_at, b.id);

-- Clear session links
UPDATE public.course_registrations SET session_id = NULL WHERE session_id IS NOT NULL;

-- Delete session data
DELETE FROM public.exam_session_courses;
DELETE FROM public.exam_sessions;

-- New simple unique constraint on (member_id, course_id)
CREATE UNIQUE INDEX IF NOT EXISTS course_registrations_member_course_uniq
  ON public.course_registrations (member_id, course_id);