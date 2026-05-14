
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-pwa-icons', 'tenant-pwa-icons', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read tenant pwa icons" ON storage.objects;
CREATE POLICY "Public read tenant pwa icons"
ON storage.objects FOR SELECT
USING (bucket_id = 'tenant-pwa-icons');

DROP POLICY IF EXISTS "Tenant admins write pwa icons" ON storage.objects;
CREATE POLICY "Tenant admins write pwa icons"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'tenant-pwa-icons'
  AND public.user_has_tenant_access(((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "Tenant admins update pwa icons" ON storage.objects;
CREATE POLICY "Tenant admins update pwa icons"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'tenant-pwa-icons'
  AND public.user_has_tenant_access(((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "Tenant admins delete pwa icons" ON storage.objects;
CREATE POLICY "Tenant admins delete pwa icons"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'tenant-pwa-icons'
  AND public.user_has_tenant_access(((storage.foldername(name))[1])::uuid)
);
