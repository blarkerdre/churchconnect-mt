UPDATE profiles p
SET tenant_id = m.tenant_id
FROM members m
WHERE m.user_id = p.user_id
  AND p.tenant_id = 'd8bbbdae-d9b3-4999-912d-3aa5999884b0'
  AND m.tenant_id IS NOT NULL
  AND m.tenant_id != 'd8bbbdae-d9b3-4999-912d-3aa5999884b0';