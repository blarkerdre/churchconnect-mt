
CREATE POLICY "Tenant admins upload tenant logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Tenant admins update tenant logos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Tenant admins delete tenant logos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
