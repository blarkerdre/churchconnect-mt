
-- 1. Replace auto_link_member_by_email with tenant-scoped version
CREATE OR REPLACE FUNCTION public.auto_link_member_by_email(
  _user_id uuid, _email text, _tenant_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _member_id uuid; _match_count integer;
BEGIN
  IF _user_id IS NULL OR _email IS NULL THEN RETURN NULL; END IF;

  SELECT id INTO _member_id FROM public.members
  WHERE user_id = _user_id
    AND (_tenant_id IS NULL OR tenant_id = _tenant_id)
  LIMIT 1;
  IF _member_id IS NOT NULL THEN RETURN _member_id; END IF;

  SELECT count(*), min(id) INTO _match_count, _member_id
  FROM public.members
  WHERE lower(email) = lower(_email)
    AND user_id IS NULL
    AND (_tenant_id IS NULL OR tenant_id = _tenant_id);

  IF _match_count = 1 AND _member_id IS NOT NULL THEN
    UPDATE public.members SET user_id = _user_id, updated_at = now()
    WHERE id = _member_id AND user_id IS NULL;
    RETURN _member_id;
  END IF;
  RETURN NULL;
END;
$$;

-- 2. Replace claim_own_member_profile with tenant-scoped version
CREATE OR REPLACE FUNCTION public.claim_own_member_profile()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _email text := lower(nullif(auth.jwt() ->> 'email', ''));
  _member_id uuid;
  _match_count integer;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT id INTO _member_id FROM public.members
  WHERE user_id = _user_id ORDER BY created_at DESC LIMIT 1;
  IF _member_id IS NOT NULL THEN RETURN _member_id; END IF;

  IF _email IS NULL THEN RETURN NULL; END IF;

  SELECT count(*) INTO _match_count
  FROM public.members m
  WHERE lower(m.email) = _email AND m.user_id IS NULL
    AND m.tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = _user_id);

  IF _match_count > 1 THEN
    RAISE EXCEPTION 'Multiple member records match this email. Please contact an administrator.';
  END IF;

  IF _match_count = 1 THEN
    SELECT m.id INTO _member_id FROM public.members m
    WHERE lower(m.email) = _email AND m.user_id IS NULL
      AND m.tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = _user_id)
    LIMIT 1;

    UPDATE public.members SET user_id = _user_id, updated_at = now()
    WHERE id = _member_id AND user_id IS NULL;
    RETURN _member_id;
  END IF;

  RETURN NULL;
END;
$$;
