
-- Rename the enum value
ALTER TYPE session_type RENAME VALUE 'WSF Meeting' TO 'Home Cell Meeting';

-- Update the is_wsf_leader_for_session function to use new enum value
CREATE OR REPLACE FUNCTION public.is_wsf_leader_for_session(_user_id uuid, _unit text, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = 'wsf_leader'
      AND ur.tenant_id = _tenant_id
  )
  AND EXISTS (
    SELECT 1
    FROM members m
    JOIN wsf_centres wc ON wc.id = m.wsf_centre_id
    WHERE m.user_id = _user_id
      AND m.tenant_id = _tenant_id
      AND wc.leader_id = m.id
  );
$$;
