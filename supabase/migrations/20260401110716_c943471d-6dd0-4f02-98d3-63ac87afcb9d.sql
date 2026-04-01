
-- Create RPC to establish tenant owner (bypasses RLS)
CREATE OR REPLACE FUNCTION public.create_tenant_owner(p_tenant_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO tenant_memberships (tenant_id, user_id, role)
  VALUES (p_tenant_id, p_user_id, 'owner')
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  INSERT INTO user_roles (user_id, role, tenant_id)
  VALUES (p_user_id, 'admin', p_tenant_id)
  ON CONFLICT (user_id, role, tenant_id) DO NOTHING;
END;
$$;
