ALTER TABLE public.church_units DROP CONSTRAINT IF EXISTS church_units_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS church_units_tenant_id_name_key ON public.church_units (tenant_id, name);