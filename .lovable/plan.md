

## Add UPDATE Policy for church-documents Storage Bucket

### Problem
The `church-documents` storage bucket has INSERT, SELECT, and DELETE policies but no UPDATE policy. This leaves the access control matrix incomplete.

### Solution
Add a single migration with a tenant-scoped UPDATE policy mirroring the existing INSERT/DELETE policies (admin or unit_leader with tenant-scoped check via folder path).

### Migration SQL
```sql
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
```

### Files changed
- **Database migration** — add UPDATE policy on `storage.objects` for `church-documents`

