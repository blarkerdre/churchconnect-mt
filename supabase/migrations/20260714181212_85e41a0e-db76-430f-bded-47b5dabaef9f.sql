
-- 1. Tighten tenant_invitations SELECT: also require pending status and non-expired invite.
DROP POLICY IF EXISTS "Users can view own pending invitations" ON public.tenant_invitations;
CREATE POLICY "Users can view own pending invitations"
ON public.tenant_invitations
FOR SELECT
TO authenticated
USING (
  status = 'pending'
  AND (expires_at IS NULL OR expires_at > now())
  AND auth.email() IS NOT NULL
  AND lower(email) = lower(auth.email())
);

-- 2. Tighten email_send_log member-read policy: match on the authenticated user's
--    own auth.email() directly, instead of member-email string matching.
DROP POLICY IF EXISTS "Members can view own received emails" ON public.email_send_log;
CREATE POLICY "Members can view own received emails"
ON public.email_send_log
FOR SELECT
TO authenticated
USING (
  user_has_tenant_access(tenant_id)
  AND auth.email() IS NOT NULL
  AND lower(recipient_email) = lower(auth.email())
  AND EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = email_send_log.tenant_id
  )
);

-- 3. Replace substring match in is_altar_ministry_member with exact token match.
CREATE OR REPLACE FUNCTION public.is_altar_ministry_member(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _unit_name text;
  _member_units text;
  _token text;
BEGIN
  IF _user_id IS NULL OR _tenant_id IS NULL THEN RETURN false; END IF;

  SELECT lower(trim(both '"' from coalesce(value::text,'')))
    INTO _unit_name
    FROM public.app_settings
   WHERE key = 'pastoral.altar_ministry_unit' AND tenant_id = _tenant_id
   LIMIT 1;
  IF _unit_name IS NULL OR _unit_name = '' THEN _unit_name := 'altar ministry'; END IF;

  SELECT lower(coalesce(church_unit,''))
    INTO _member_units
    FROM public.members
   WHERE user_id = _user_id AND tenant_id = _tenant_id
   LIMIT 1;

  IF _member_units IS NOT NULL AND _member_units <> '' THEN
    -- Exact token match on comma/semicolon/pipe-separated unit list.
    FOREACH _token IN ARRAY regexp_split_to_array(_member_units, '\s*[,;|]\s*') LOOP
      IF trim(_token) = _unit_name THEN
        RETURN true;
      END IF;
    END LOOP;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.unit_leader_assignments
     WHERE user_id = _user_id AND tenant_id = _tenant_id AND lower(unit_name) = _unit_name
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;
