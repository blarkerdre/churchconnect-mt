ALTER TABLE public.attendance_sessions
  ADD CONSTRAINT attendance_sessions_created_by_profiles_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(user_id) ON DELETE SET NULL;