ALTER TABLE public.course_registrations
  ADD CONSTRAINT course_registrations_member_id_fkey
  FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;