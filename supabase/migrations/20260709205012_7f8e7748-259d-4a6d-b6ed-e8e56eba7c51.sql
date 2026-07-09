
-- Admins can manage all statement PDFs within their tenant
CREATE POLICY "Admins can read exam statements in their tenant"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'exam-statements'
  AND public.is_admin(auth.uid(), (storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Admins can upload exam statements in their tenant"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'exam-statements'
  AND public.is_admin(auth.uid(), (storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Admins can delete exam statements in their tenant"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'exam-statements'
  AND public.is_admin(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- Members can download their own statement
-- Path structure: {tenant_id}/{course_id}/{member_id}/{filename}
CREATE POLICY "Members can read their own statement"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'exam-statements'
  AND EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.id::text = (storage.foldername(name))[3]
      AND m.tenant_id::text = (storage.foldername(name))[1]
  )
);
