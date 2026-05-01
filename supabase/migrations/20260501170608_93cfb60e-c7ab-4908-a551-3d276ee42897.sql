CREATE TABLE public.sermon_note_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id, name)
);

ALTER TABLE public.sermon_note_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own sermon folders"
  ON public.sermon_note_folders FOR SELECT
  USING (auth.uid() = user_id AND public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users insert own sermon folders"
  ON public.sermon_note_folders FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users update own sermon folders"
  ON public.sermon_note_folders FOR UPDATE
  USING (auth.uid() = user_id AND public.user_has_tenant_access(tenant_id))
  WITH CHECK (auth.uid() = user_id AND public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users delete own sermon folders"
  ON public.sermon_note_folders FOR DELETE
  USING (auth.uid() = user_id AND public.user_has_tenant_access(tenant_id));

CREATE INDEX idx_sermon_note_folders_user_tenant
  ON public.sermon_note_folders (user_id, tenant_id);

CREATE TRIGGER update_sermon_note_folders_updated_at
  BEFORE UPDATE ON public.sermon_note_folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.sermon_notes
  ADD COLUMN folder_id uuid REFERENCES public.sermon_note_folders(id) ON DELETE SET NULL;

CREATE INDEX idx_sermon_notes_folder ON public.sermon_notes (folder_id);