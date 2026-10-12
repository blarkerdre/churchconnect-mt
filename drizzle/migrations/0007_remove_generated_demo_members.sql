DO $$
BEGIN
  CREATE TEMP TABLE gen ON COMMIT DROP AS
  SELECT id, user_id, tenant_id FROM public.members
  WHERE (email LIKE '%-%@%'
      OR email LIKE 'demo.member%@demochurch.test'
      OR (email LIKE '%@test.com' AND tenant_id = 'd8bbbdae-d9b3-4999-912d-3aa5999884b0'))
    AND tenant_id <> '95e53cc3-4569-4dd3-a4ad-3489593dce81';

  DELETE FROM public.attendance_records WHERE member_id IN (SELECT id FROM gen);
  DELETE FROM public.followups WHERE member_id IN (SELECT id FROM gen);
  DELETE FROM public.member_status_history WHERE member_id IN (SELECT id FROM gen);
  DELETE FROM public.members WHERE id IN (SELECT id FROM gen);
  DELETE FROM public.tenant_memberships WHERE user_id IN (SELECT user_id FROM gen WHERE user_id IS NOT NULL);
  DELETE FROM public.user_roles WHERE user_id IN (SELECT user_id FROM gen WHERE user_id IS NOT NULL);
  DELETE FROM public.profiles WHERE id IN (SELECT user_id FROM gen WHERE user_id IS NOT NULL);
  DELETE FROM auth.users WHERE id IN (SELECT user_id FROM gen WHERE user_id IS NOT NULL)
    AND id <> '6483c76f-3ce3-4f14-b0af-0c8a98ebb484';
END $$;