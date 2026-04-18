-- ============================================================
-- SECURITY HARDENING ROUND 2
-- ============================================================

-- ─── 1. Tighten members INSERT policy ──────────────────────────
-- Unit leaders may only insert members in units they actually lead
DROP POLICY IF EXISTS "Admins can insert members" ON public.members;
DROP POLICY IF EXISTS "Admins or scoped leaders can insert members" ON public.members;

CREATE POLICY "Admins or scoped leaders can insert members"
ON public.members FOR INSERT
TO authenticated
WITH CHECK (
  user_has_tenant_access(tenant_id) AND (
    is_admin(auth.uid(), tenant_id)
    OR (
      has_role(auth.uid(), 'unit_leader'::app_role, tenant_id)
      AND is_unit_leader_for_member(auth.uid(), church_unit, tenant_id)
    )
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
);

-- ─── 2. Restrict church-documents storage to admins/leaders ────
-- Path layout: <tenant_id>/<related_table>/<related_id>/<uuid>.<ext>
DROP POLICY IF EXISTS "Tenant members can upload church documents" ON storage.objects;
DROP POLICY IF EXISTS "Tenant members can delete church documents" ON storage.objects;
DROP POLICY IF EXISTS "Tenant members can view church documents" ON storage.objects;
DROP POLICY IF EXISTS "Tenant members can update church documents" ON storage.objects;
DROP POLICY IF EXISTS "Tenant members read church documents" ON storage.objects;
DROP POLICY IF EXISTS "Tenant members write church documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins and leaders manage church documents" ON storage.objects;

CREATE POLICY "Admins and leaders read church documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'church-documents'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
      AND (
        is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
        OR has_role(auth.uid(), 'unit_leader'::app_role, ((storage.foldername(name))[1])::uuid)
      )
    )
  )
);

CREATE POLICY "Admins and leaders write church documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'church-documents'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
      AND (
        is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
        OR has_role(auth.uid(), 'unit_leader'::app_role, ((storage.foldername(name))[1])::uuid)
      )
    )
  )
);

CREATE POLICY "Admins and leaders update church documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'church-documents'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
      AND (
        is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
        OR has_role(auth.uid(), 'unit_leader'::app_role, ((storage.foldername(name))[1])::uuid)
      )
    )
  )
);

CREATE POLICY "Admins and leaders delete church documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'church-documents'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
      AND (
        is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
        OR has_role(auth.uid(), 'unit_leader'::app_role, ((storage.foldername(name))[1])::uuid)
      )
    )
  )
);

-- ─── 3. Validate certificate template colors at DB level ───────
CREATE OR REPLACE FUNCTION public.validate_certificate_colors()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.background_color IS NOT NULL AND NEW.background_color !~ '^#[0-9a-fA-F]{6}$' THEN
    RAISE EXCEPTION 'Invalid background_color: must be a 6-digit hex color (e.g. #1a2d4d)';
  END IF;
  IF NEW.accent_color IS NOT NULL AND NEW.accent_color !~ '^#[0-9a-fA-F]{6}$' THEN
    RAISE EXCEPTION 'Invalid accent_color: must be a 6-digit hex color (e.g. #c5a028)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_cert_colors ON public.certificate_templates;
CREATE TRIGGER trg_validate_cert_colors
BEFORE INSERT OR UPDATE ON public.certificate_templates
FOR EACH ROW EXECUTE FUNCTION public.validate_certificate_colors();