
## Security Findings Triage

### 1. `members_table_privilege_escalation` — **FIX (high priority)**
Tighten the INSERT policy on `members` so unit leaders can only insert members whose `church_unit` matches a unit they actually lead. Admins remain unrestricted.

```sql
DROP POLICY IF EXISTS "Admins can insert members" ON public.members;

CREATE POLICY "Admins or scoped leaders can insert members"
ON public.members FOR INSERT TO authenticated
WITH CHECK (
  user_has_tenant_access(tenant_id) AND (
    is_admin(auth.uid(), tenant_id)
    OR (
      has_role(auth.uid(), 'unit_leader'::app_role, tenant_id)
      AND is_unit_leader_for_member(auth.uid(), church_unit, tenant_id)
    )
  )
);
```
Relies on the already-fixed exact-match `is_unit_leader_for_member`.

### 2. `profile_photos_bucket_public` + `SUPA_public_bucket_allows_listing` — **FIX**
Switch `profile-photos` to **private**, route reads through signed URLs.

```sql
UPDATE storage.buckets SET public = false WHERE id = 'profile-photos';

DROP POLICY IF EXISTS "Authenticated read profile photos" ON storage.objects;

CREATE POLICY "Tenant members read profile photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'profile-photos');
```
Code edits — replace `getPublicUrl` with `createSignedUrl(path, 3600)` in:
- `src/components/members/MemberFormDialog.jsx`
- `src/components/members/MemberTable.jsx`
- `src/pages/MyProfile.jsx`
- `src/components/profile/MemberFeed.jsx`
- any other read site found via grep.

For `book-covers` (also flagged): keep public (used on landing/dashboard for unauthenticated viewers via direct URL) but ensure no listing policy exists — already addressed in last migration.

### 3. `church_docs_member_access` — **FIX**
Restrict `church-documents` storage RLS to admins + unit leaders only (matches `documents` table policy).

```sql
DROP POLICY IF EXISTS "Tenant members can upload church documents" ON storage.objects;
DROP POLICY IF EXISTS "Tenant members can delete church documents" ON storage.objects;
DROP POLICY IF EXISTS "Tenant members can view church documents" ON storage.objects;
DROP POLICY IF EXISTS "Tenant members can update church documents" ON storage.objects;

-- Path layout: <tenant_id>/<related_table>/<related_id>/<uuid>.<ext>
CREATE POLICY "Admins/leaders manage church documents"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'church-documents' AND
  (storage.foldername(name))[1]::uuid IN (
    SELECT t.id FROM public.tenants t
    WHERE is_admin(auth.uid(), t.id)
       OR has_role(auth.uid(), 'unit_leader'::app_role, t.id)
  )
)
WITH CHECK (
  bucket_id = 'church-documents' AND
  (storage.foldername(name))[1]::uuid IN (
    SELECT t.id FROM public.tenants t
    WHERE is_admin(auth.uid(), t.id)
       OR has_role(auth.uid(), 'unit_leader'::app_role, t.id)
  )
);
```

### 4. `svg_xss_cert_colors` — **FIX**
In `src/components/certificates/CertificateTemplateSettings.jsx` (and any preview using `dangerouslySetInnerHTML`), validate `background_color` / `accent_color` against `/^#[0-9a-fA-F]{6}$/` before interpolation. Reject (or fall back to default) on invalid input both client-side and via a CHECK constraint or validation trigger on `certificate_templates`.

```sql
CREATE OR REPLACE FUNCTION public.validate_certificate_colors()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.background_color !~ '^#[0-9a-fA-F]{6}$' THEN
    RAISE EXCEPTION 'Invalid background_color';
  END IF;
  IF NEW.accent_color !~ '^#[0-9a-fA-F]{6}$' THEN
    RAISE EXCEPTION 'Invalid accent_color';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_validate_cert_colors
BEFORE INSERT OR UPDATE ON public.certificate_templates
FOR EACH ROW EXECUTE FUNCTION public.validate_certificate_colors();
```

### 5. `SUPA_extension_in_public` — **FIX (low risk)**
Move common extensions out of `public` into a dedicated `extensions` schema:
```sql
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
ALTER EXTENSION unaccent SET SCHEMA extensions;
-- (only those actually present in public; will inspect during implementation)
```
I'll list extensions first and only move safe, non-managed ones (skip `pg_graphql`, `pg_net`, `pgsodium`, `supabase_vault`, `pgjwt`).

### 6. `register_tenant_noauth` — **IGNORE (re-confirm)**
Already addressed last round: this is the public church-onboarding wizard at `/onboard`. The "super_admin" role is **tenant-scoped** (`tenant_id = tenant.id`), not platform-wide. I'll re-mark as ignored with the same justification.

## Files / Migrations
- **Migration**: scoped INSERT policy on `members`; private `profile-photos` bucket + new SELECT policy; tighten `church-documents` storage RLS; certificate color validation trigger; move extensions out of `public`.
- **Edits**: swap `getPublicUrl` → `createSignedUrl` in member photo read paths (4–5 files).
- **Edit**: `CertificateTemplateSettings.jsx` — sanitize colors before SVG interpolation.
- **Mark ignored**: `register_tenant_noauth` (re-justified).

After approval I'll inspect the exact extension list and member-photo read sites before applying everything in one pass.
