-- Detect whether a user has a verified MFA factor (runs as owner to read auth schema)
CREATE OR REPLACE FUNCTION public.user_has_verified_mfa(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.mfa_factors f
    WHERE f.user_id = _user_id AND f.status = 'verified'
  )
$$;

REVOKE ALL ON FUNCTION public.user_has_verified_mfa(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_verified_mfa(uuid) TO authenticated, service_role;

-- True unless the caller has MFA enrolled but has not elevated this session to aal2
CREATE OR REPLACE FUNCTION public.mfa_satisfied()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    CASE
      WHEN auth.uid() IS NULL THEN true
      WHEN coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2' THEN true
      ELSE NOT public.user_has_verified_mfa(auth.uid())
    END
$$;

REVOKE ALL ON FUNCTION public.mfa_satisfied() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mfa_satisfied() TO authenticated, anon, service_role;

-- Apply as RESTRICTIVE policies so they intersect with existing permissive rules
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'members','profiles','user_roles','tenant_memberships','tenants','audit_log',
    'documents','tenant_api_keys','domifort_api_tokens','pastoral_care',
    'children','teens','preteens','child_checkins','life_event_requests',
    'data_export_requests','erasure_requests','call_log','sms_log','contacts'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('DROP POLICY IF EXISTS "Require completed two-step verification" ON public.%I', t);
      EXECUTE format($f$
        CREATE POLICY "Require completed two-step verification"
        ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
        USING (public.mfa_satisfied())
        WITH CHECK (public.mfa_satisfied())
      $f$, t);
    END IF;
  END LOOP;
END $$;