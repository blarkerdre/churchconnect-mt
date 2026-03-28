
-- 1. Allow authenticated users to SELECT their own pending invitations
CREATE POLICY "Users can view own pending invitations"
ON public.tenant_invitations
FOR SELECT
TO authenticated
USING (lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())::text));

-- 2. Allow authenticated users to INSERT their own user_roles when a pending invitation exists
CREATE POLICY "Users can self-insert role via invitation"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.tenant_invitations ti
    WHERE lower(ti.email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())::text)
    AND ti.tenant_id = user_roles.tenant_id
    AND ti.status = 'pending'
  )
);

-- 3. Update handle_new_user trigger to also create tenant_memberships and user_roles from invitations
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant_id uuid;
  _inv_id uuid;
  _inv_role text;
BEGIN
  -- Try to resolve tenant from a pending invitation
  SELECT tenant_id, id, role INTO _tenant_id, _inv_id, _inv_role
  FROM public.tenant_invitations
  WHERE lower(email) = lower(NEW.email)
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  -- Create profile
  INSERT INTO public.profiles (user_id, full_name, email, tenant_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    _tenant_id
  )
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        tenant_id = COALESCE(profiles.tenant_id, EXCLUDED.tenant_id);

  -- If there's a pending invitation, auto-accept it
  IF _tenant_id IS NOT NULL THEN
    INSERT INTO public.tenant_memberships (user_id, tenant_id, role)
    VALUES (NEW.id, _tenant_id, COALESCE(_inv_role, 'member'))
    ON CONFLICT (user_id, tenant_id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role, tenant_id)
    VALUES (NEW.id, 'member', _tenant_id)
    ON CONFLICT (user_id, role, tenant_id) DO NOTHING;

    UPDATE public.tenant_invitations
    SET status = 'accepted'
    WHERE id = _inv_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Fix orphaned profile for mayodare@gmail.com
DO $$
DECLARE
  _user_id uuid := '7a48c19d-8cc8-46eb-a3e1-a8fdeaf8bcf1';
  _tenant_id uuid;
  _inv_id uuid;
BEGIN
  SELECT tenant_id, id INTO _tenant_id, _inv_id
  FROM public.tenant_invitations
  WHERE lower(email) = lower('mayodare@gmail.com') AND status = 'pending'
  LIMIT 1;

  IF _tenant_id IS NULL THEN
    _tenant_id := 'd8bbbdae-d9b3-4999-912d-3aa5999884b0';
  END IF;

  UPDATE public.profiles SET tenant_id = _tenant_id WHERE user_id = _user_id AND tenant_id IS NULL;

  INSERT INTO public.tenant_memberships (user_id, tenant_id, role)
  VALUES (_user_id, _tenant_id, 'member')
  ON CONFLICT (user_id, tenant_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (_user_id, 'member', _tenant_id)
  ON CONFLICT (user_id, role, tenant_id) DO NOTHING;

  IF _inv_id IS NOT NULL THEN
    UPDATE public.tenant_invitations SET status = 'accepted' WHERE id = _inv_id;
  END IF;
END $$;

-- 5. Backfill remaining orphaned profiles
UPDATE public.profiles p
SET tenant_id = (
  SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = p.user_id LIMIT 1
)
WHERE p.tenant_id IS NULL
  AND EXISTS (SELECT 1 FROM public.tenant_memberships tm WHERE tm.user_id = p.user_id);
