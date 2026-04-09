CREATE POLICY "Tenant-scoped update church-documents" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'church-documents'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (
      public.is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
      OR public.has_role(auth.uid(), 'unit_leader'::public.app_role, ((storage.foldername(name))[1])::uuid)
    )
  )
  WITH CHECK (
    bucket_id = 'church-documents'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (
      public.is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
      OR public.has_role(auth.uid(), 'unit_leader'::public.app_role, ((storage.foldername(name))[1])::uuid)
    )
  );