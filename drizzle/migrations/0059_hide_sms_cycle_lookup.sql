REVOKE EXECUTE ON FUNCTION public.sms_cycle_start_for(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sms_cycle_start_for(uuid) TO service_role;