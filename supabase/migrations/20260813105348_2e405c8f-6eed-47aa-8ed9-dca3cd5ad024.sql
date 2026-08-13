DROP POLICY IF EXISTS "Admins can view all tenant notes" ON public.sermon_notes;
DROP POLICY IF EXISTS "Users can view own notes" ON public.sermon_notes;
DROP POLICY IF EXISTS "Users can create own notes" ON public.sermon_notes;
DROP POLICY IF EXISTS "Users can update own notes" ON public.sermon_notes;
DROP POLICY IF EXISTS "Users can delete own notes" ON public.sermon_notes;

CREATE POLICY "Users can view own notes" ON public.sermon_notes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own notes" ON public.sermon_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notes" ON public.sermon_notes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own notes" ON public.sermon_notes FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own sermon folders" ON public.sermon_note_folders;
DROP POLICY IF EXISTS "Users insert own sermon folders" ON public.sermon_note_folders;
DROP POLICY IF EXISTS "Users update own sermon folders" ON public.sermon_note_folders;
DROP POLICY IF EXISTS "Users delete own sermon folders" ON public.sermon_note_folders;

CREATE POLICY "Users view own sermon folders" ON public.sermon_note_folders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sermon folders" ON public.sermon_note_folders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sermon folders" ON public.sermon_note_folders FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own sermon folders" ON public.sermon_note_folders FOR DELETE TO authenticated USING (auth.uid() = user_id);