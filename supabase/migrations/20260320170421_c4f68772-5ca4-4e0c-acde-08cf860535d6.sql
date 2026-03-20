CREATE POLICY "Members can read own certificates"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'church-documents'
  AND (storage.foldername(name))[1] = 'certificates'
  AND EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND (storage.foldername(name))[2] = m.id::text
  )
);