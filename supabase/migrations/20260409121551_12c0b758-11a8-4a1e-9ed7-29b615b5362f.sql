
CREATE TABLE public.sermon_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id),
  title text,
  speaker text,
  service_date date NOT NULL DEFAULT CURRENT_DATE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sermon_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notes"
  ON public.sermon_notes FOR SELECT
  USING (auth.uid() = user_id AND public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can create own notes"
  ON public.sermon_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can update own notes"
  ON public.sermon_notes FOR UPDATE
  USING (auth.uid() = user_id AND public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can delete own notes"
  ON public.sermon_notes FOR DELETE
  USING (auth.uid() = user_id AND public.user_has_tenant_access(tenant_id));

CREATE POLICY "Admins can view all tenant notes"
  ON public.sermon_notes FOR SELECT
  USING (public.is_admin(auth.uid(), tenant_id));

CREATE TRIGGER update_sermon_notes_updated_at
  BEFORE UPDATE ON public.sermon_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_sermon_notes_user_tenant ON public.sermon_notes (user_id, tenant_id);
