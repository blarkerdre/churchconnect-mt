DELETE FROM public.notifications n
WHERE n.type = 'billing'
  AND NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.user_id = n.user_id
      AND tm.tenant_id = n.tenant_id
      AND tm.role IN ('owner', 'admin')
  );