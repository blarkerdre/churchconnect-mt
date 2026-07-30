ALTER TABLE public.preteens
  ADD CONSTRAINT preteens_primary_guardian_member_id_fkey
  FOREIGN KEY (primary_guardian_member_id) REFERENCES public.members(id) ON DELETE CASCADE;