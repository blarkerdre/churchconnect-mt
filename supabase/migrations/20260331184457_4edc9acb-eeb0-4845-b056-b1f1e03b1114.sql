
INSERT INTO user_roles (user_id, role, tenant_id)
SELECT DISTINCT m.user_id, 'member'::app_role, m.tenant_id
FROM members m
WHERE m.user_id IS NOT NULL
  AND m.tenant_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = m.user_id AND ur.role = 'member' AND ur.tenant_id = m.tenant_id
  )
ON CONFLICT (user_id, role, tenant_id) DO NOTHING;
