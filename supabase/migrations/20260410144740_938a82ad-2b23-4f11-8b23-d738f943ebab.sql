INSERT INTO storage.buckets (id, name, public)
VALUES ('church-documents', 'church-documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;