
DROP POLICY IF EXISTS "Authenticated read book covers" ON storage.objects;
CREATE POLICY "Same-tenant read book covers"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'book-covers'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND public.user_belongs_to_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
