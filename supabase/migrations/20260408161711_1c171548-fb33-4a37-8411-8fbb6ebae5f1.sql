CREATE POLICY "Anon can read consent settings"
ON public.app_settings
FOR SELECT
TO anon
USING (key IN ('consent_text', 'privacy_policy_url'));