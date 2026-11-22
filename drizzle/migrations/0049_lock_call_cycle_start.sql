REVOKE ALL ON FUNCTION public.call_cycle_start(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.call_cycle_start(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.call_cycle_start(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.call_cycle_start(uuid) TO service_role;