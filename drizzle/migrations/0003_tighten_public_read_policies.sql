DROP POLICY IF EXISTS "Anyone can view Trustpilot settings" ON public.trustpilot_settings;
CREATE POLICY "Anyone can view enabled Trustpilot settings" ON public.trustpilot_settings
  FOR SELECT TO anon, authenticated USING (is_enabled = true);

-- Public buckets still serve files by public URL; these rules only stop
-- listing/enumerating objects outside the caller's own church folder.
DROP POLICY IF EXISTS "Public can view dashboard banners" ON storage.objects;
DROP POLICY IF EXISTS "tenant_branding_public_read" ON storage.objects;
DROP POLICY IF EXISTS "Public read tenant pwa icons" ON storage.objects;

CREATE POLICY "Tenant members read own public assets" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('dashboard-banners','tenant-branding','tenant-pwa-icons')
    AND (
      public.has_role(auth.uid(), 'super_admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.tenant_memberships tm
        WHERE tm.user_id = auth.uid()
          AND tm.tenant_id::text = (storage.foldername(name))[1]
      )
    )
  );