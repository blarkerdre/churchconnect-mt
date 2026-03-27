-- Backfill tenant_memberships for members with linked user accounts
INSERT INTO public.tenant_memberships (user_id, tenant_id, role)
SELECT m.user_id, m.tenant_id, 'member'
FROM public.members m
WHERE m.user_id IS NOT NULL AND m.tenant_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.user_id = m.user_id AND tm.tenant_id = m.tenant_id
  )
ON CONFLICT DO NOTHING;

-- Backfill user_roles for members with linked user accounts
INSERT INTO public.user_roles (user_id, role, tenant_id)
SELECT m.user_id, 'member', m.tenant_id
FROM public.members m
WHERE m.user_id IS NOT NULL AND m.tenant_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = m.user_id AND ur.role = 'member' AND ur.tenant_id = m.tenant_id
  )
ON CONFLICT DO NOTHING;