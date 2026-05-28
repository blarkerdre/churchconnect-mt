-- Drop the overly broad anon read policy
DROP POLICY IF EXISTS "Anon can read consent settings" ON public.app_settings;

-- Provide a tenant-scoped, read-only function for unauthenticated public registration pages
CREATE OR REPLACE FUNCTION public.get_public_consent_settings(_tenant_id uuid)
RETURNS TABLE(key text, value jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.key, s.value
  FROM public.app_settings s
  WHERE s.tenant_id = _tenant_id
    AND s.key IN ('consent_text', 'privacy_policy_url')
$$;

GRANT EXECUTE ON FUNCTION public.get_public_consent_settings(uuid) TO anon, authenticated;
