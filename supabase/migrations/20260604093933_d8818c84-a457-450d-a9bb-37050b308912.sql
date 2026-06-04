-- Tighten SELECT access on app_settings: hide sensitive credential keys from non-admin members.
DROP POLICY IF EXISTS "Authenticated can view settings" ON public.app_settings;

CREATE POLICY "Members view non-sensitive settings, admins view all"
ON public.app_settings
FOR SELECT
TO authenticated
USING (
  public.user_has_tenant_access(tenant_id)
  AND (
    public.is_admin(auth.uid(), tenant_id)
    OR key NOT IN (
      'africastalking_api_key',
      'africastalking_username',
      'africastalking_sender_id',
      'termii_api_key',
      'termii_sender_id',
      'custom_sms_provider_config',
      'custom_voice_provider_config'
    )
  )
);