-- Fix orphaned member: assign to wci-cardiff tenant
UPDATE public.members
SET tenant_id = '95e53cc3-4569-4dd3-a4ad-3489593dce81', updated_at = now()
WHERE id = '9991841c-e4d1-4098-bd83-a4c9863b21ed' AND tenant_id IS NULL;

-- Ensure tenant_memberships
INSERT INTO public.tenant_memberships (user_id, tenant_id, role)
VALUES ('fbb421e8-4464-4eb1-8179-0b2611db5fc7', '95e53cc3-4569-4dd3-a4ad-3489593dce81', 'member')
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- Ensure user_roles (unique constraint is on user_id, role)
INSERT INTO public.user_roles (user_id, role, tenant_id)
VALUES ('fbb421e8-4464-4eb1-8179-0b2611db5fc7', 'member', '95e53cc3-4569-4dd3-a4ad-3489593dce81')
ON CONFLICT (user_id, role) DO UPDATE SET tenant_id = EXCLUDED.tenant_id;

-- Catch any other orphans
UPDATE public.members m
SET tenant_id = (
  SELECT tm.tenant_id FROM public.tenant_memberships tm
  WHERE tm.user_id = m.user_id LIMIT 1
), updated_at = now()
WHERE m.user_id IS NOT NULL AND m.tenant_id IS NULL
  AND EXISTS (SELECT 1 FROM public.tenant_memberships tm WHERE tm.user_id = m.user_id);