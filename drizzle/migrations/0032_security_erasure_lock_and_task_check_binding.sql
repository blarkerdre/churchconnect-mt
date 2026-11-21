CREATE OR REPLACE FUNCTION public.erasure_requests_member_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  m_tenant uuid;
  m_user uuid;
BEGIN
  -- Who and where a request is for can never be changed by a signed-in user
  -- after it has been made (admins only review the status).
  IF TG_OP = 'UPDATE' AND auth.uid() IS NOT NULL THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.member_id IS DISTINCT FROM OLD.member_id THEN
      RAISE EXCEPTION 'The person, church and member record on an erasure request cannot be changed';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.user_id IS NOT NULL
     AND NOT public.person_in_tenant(NEW.user_id, NEW.tenant_id) THEN
    RAISE EXCEPTION 'This person does not belong to this church';
  END IF;

  IF NEW.member_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT tenant_id, user_id INTO m_tenant, m_user
  FROM public.members WHERE id = NEW.member_id;

  IF NOT FOUND OR m_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Member does not belong to this church';
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT public.is_admin(auth.uid(), NEW.tenant_id)
     AND m_user IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only request erasure of your own record';
  END IF;

  IF m_user IS NOT NULL AND NEW.user_id IS NOT NULL AND m_user <> NEW.user_id THEN
    RAISE EXCEPTION 'Member record does not match the requesting account';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.erasure_requests_member_guard() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.can_manage_unit_task(_user_id uuid, _task_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (auth.uid() IS NULL OR _user_id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.unit_tasks t
      WHERE t.id = _task_id
        AND t.tenant_id = _tenant_id
        AND (
          public.has_role(_user_id, 'super_admin'::public.app_role)
          OR public.is_admin(_user_id, t.tenant_id)
          OR public.user_leads_unit(_user_id, t.unit_name, t.tenant_id)
        )
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_unit_task(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_unit_task(uuid, uuid, uuid) TO authenticated, service_role;