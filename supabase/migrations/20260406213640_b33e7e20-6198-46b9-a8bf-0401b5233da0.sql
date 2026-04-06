ALTER TABLE public.announcements
  DROP CONSTRAINT announcements_created_by_fkey;

ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_created_by_profiles_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(user_id)
  ON DELETE SET NULL;