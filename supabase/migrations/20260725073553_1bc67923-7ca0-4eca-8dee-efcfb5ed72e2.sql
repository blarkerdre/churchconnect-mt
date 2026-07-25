-- 1. Super-admin bypass on members and coupled tables (additive OR-policies)

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'members',
    'attendance_records',
    'followups',
    'pastoral_care',
    'transportation',
    'event_registrations',
    'course_registrations',
    'wofbi_applications',
    'member_status_history'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Super admins can manage %I" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "Super admins can manage %1$I" ON public.%1$I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''super_admin''::app_role)) WITH CHECK (public.has_role(auth.uid(), ''super_admin''::app_role))',
      t
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Super admins can delete tenant memberships" ON public.tenant_memberships;
CREATE POLICY "Super admins can delete tenant memberships"
  ON public.tenant_memberships FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 2. Clean up the duplicate Akinmolayan record
-- Repoint her two child_checkins from the duplicate visitor row to the surviving active row.
ALTER TABLE public.child_checkins DISABLE TRIGGER USER;
UPDATE public.child_checkins
    SET dropoff_parent_member_id = '7529f503-b4f1-41ea-a6b4-b3aae9aab979'::uuid
 WHERE dropoff_parent_member_id = 'bcd6c190-9556-411f-b192-efb45595a8e3'::uuid
   AND tenant_id = '95e53cc3-4569-4dd3-a4ad-3489593dce81'::uuid;

UPDATE public.child_checkins
    SET pickup_adult_member_id = '7529f503-b4f1-41ea-a6b4-b3aae9aab979'::uuid
 WHERE pickup_adult_member_id = 'bcd6c190-9556-411f-b192-efb45595a8e3'::uuid
   AND tenant_id = '95e53cc3-4569-4dd3-a4ad-3489593dce81'::uuid;
ALTER TABLE public.child_checkins ENABLE TRIGGER USER;

DELETE FROM public.members m
WHERE m.id = 'bcd6c190-9556-411f-b192-efb45595a8e3'::uuid
  AND m.tenant_id = '95e53cc3-4569-4dd3-a4ad-3489593dce81'::uuid
  AND m.user_id IS NULL;

-- 3. Enforce future uniqueness: (tenant_id, lower(email))
DO $$
DECLARE
  dupes int;
BEGIN
  SELECT count(*) INTO dupes FROM (
    SELECT tenant_id, lower(email)
    FROM public.members
    WHERE email IS NOT NULL AND email <> ''
    GROUP BY tenant_id, lower(email)
    HAVING count(*) > 1
  ) d;
  IF dupes > 0 THEN
    RAISE EXCEPTION 'Cannot create unique index: % duplicate (tenant_id, email) group(s) still present in public.members', dupes;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS members_tenant_email_uidx
  ON public.members (tenant_id, lower(email))
  WHERE email IS NOT NULL AND email <> '';
