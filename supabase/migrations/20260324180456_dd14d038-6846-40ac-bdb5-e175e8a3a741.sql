-- Drop the old unique constraint on key only, add composite unique on (key, tenant_id)
ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_key_key;
CREATE UNIQUE INDEX app_settings_key_tenant_id_unique ON public.app_settings (key, COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid));