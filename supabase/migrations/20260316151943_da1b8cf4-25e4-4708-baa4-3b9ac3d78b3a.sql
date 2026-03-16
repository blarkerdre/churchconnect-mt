
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  description text,
  uploaded_by uuid,
  related_table text,
  related_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/leaders can manage documents" ON public.documents
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role))
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role));

CREATE POLICY "Admins/leaders can view documents" ON public.documents
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role));

INSERT INTO storage.buckets (id, name, public) VALUES ('church-documents', 'church-documents', false);

CREATE POLICY "Admins/leaders can upload church docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'church-documents' AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)));

CREATE POLICY "Admins/leaders can read church docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'church-documents' AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)));

CREATE POLICY "Admins/leaders can delete church docs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'church-documents' AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)));
