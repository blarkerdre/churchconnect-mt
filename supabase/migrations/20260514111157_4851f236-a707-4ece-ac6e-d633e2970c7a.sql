REVOKE EXECUTE ON FUNCTION public.get_tenant_storage_usage_mb(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_tenant_storage_quota(uuid, bigint) FROM anon;