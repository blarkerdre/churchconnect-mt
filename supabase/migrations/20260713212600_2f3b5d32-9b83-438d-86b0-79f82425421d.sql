
-- Tighten child_pickup_delegations SELECT policy: workers only see today's active, unused delegations
DROP POLICY IF EXISTS "Read delegations for own children or workers" ON public.child_pickup_delegations;

CREATE POLICY "Read delegations for own children or workers"
ON public.child_pickup_delegations
FOR SELECT
USING (
  -- Guardian who issued the delegation
  (EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = child_pickup_delegations.issued_by_member_id
      AND m.user_id = auth.uid()
  ))
  -- Admins see all
  OR public.is_admin(auth.uid(), tenant_id)
  -- Children's church workers only see delegations relevant to today's pickup duties
  OR (
    public.is_children_church_member(auth.uid(), tenant_id)
    AND valid_on = CURRENT_DATE
    AND used_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  )
);

-- Tighten profile-photos storage read policy: require BOTH caller and owner to be members
-- of the same tenant (via public.members), not merely share any tenant_membership.
DROP POLICY IF EXISTS "profile_photos_read_same_tenant" ON storage.objects;

CREATE POLICY "profile_photos_read_same_tenant"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'profile-photos'
  AND (
    -- Owner viewing their own photo
    (storage.foldername(name))[1] = (auth.uid())::text
    -- Super admins
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    -- Same-tenant members via public.members (tighter than tenant_memberships join)
    OR (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
      AND EXISTS (
        SELECT 1
        FROM public.members caller_m
        JOIN public.members owner_m
          ON owner_m.tenant_id = caller_m.tenant_id
        WHERE caller_m.user_id = auth.uid()
          AND owner_m.user_id::text = (storage.foldername(objects.name))[1]
      )
    )
  )
);
