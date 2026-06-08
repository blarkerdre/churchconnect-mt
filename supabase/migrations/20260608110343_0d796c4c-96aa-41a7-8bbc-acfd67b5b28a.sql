ALTER TABLE public.certificate_templates DROP CONSTRAINT IF EXISTS certificate_templates_training_type_key;
ALTER TABLE public.certificate_templates ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.certificate_templates ADD CONSTRAINT certificate_templates_tenant_training_type_key UNIQUE (tenant_id, training_type);