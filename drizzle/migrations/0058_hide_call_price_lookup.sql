REVOKE EXECUTE ON FUNCTION public.call_minute_price_for_tenant(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.call_minute_price_for_tenant(uuid) TO service_role;