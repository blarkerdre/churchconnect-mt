

## Fix: Church Logo Upload RLS Violation

### Root Cause
The Settings branding section uploads the church logo to the `profile-photos` storage bucket at path `${tenantId}/tenant-logo.${ext}`. However, the INSERT policy on `profile-photos` only allows uploads where the first folder matches `auth.uid()`. Since `tenantId ≠ auth.uid()`, the upload is blocked.

### Solution
Add a new INSERT policy on `storage.objects` that allows tenant admins to upload to tenant-prefixed paths in `profile-photos`. Also add matching UPDATE and DELETE policies so logos can be replaced or removed.

### Database Migration

```sql
-- Allow tenant admins to upload logos to profile-photos under their tenant folder
CREATE POLICY "Tenant admins upload tenant logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- Allow tenant admins to update tenant logos
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

-- Allow tenant admins to delete tenant logos
CREATE POLICY "Tenant admins delete tenant logos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
```

### No code changes needed
The upload code in `Settings.jsx` is correct — the path `${tenantId}/tenant-logo.${ext}` is appropriate. Only the RLS policies need updating.

### Files changed
- **Migration**: Add 3 storage RLS policies for tenant admin logo management

