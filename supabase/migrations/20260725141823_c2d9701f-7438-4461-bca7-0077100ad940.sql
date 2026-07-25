CREATE UNIQUE INDEX IF NOT EXISTS children_tenant_name_dob_active_uniq
  ON public.children (tenant_id, lower(trim(first_name)), lower(trim(last_name)), date_of_birth)
  WHERE archived_at IS NULL;