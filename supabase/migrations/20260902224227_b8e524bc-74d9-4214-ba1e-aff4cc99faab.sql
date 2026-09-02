REVOKE EXECUTE ON FUNCTION public.can_read_traffic(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_traffic_summary(uuid, timestamptz, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_traffic_series(uuid, timestamptz, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_traffic_locations(uuid, timestamptz, timestamptz, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_traffic_top_pages(uuid, timestamptz, timestamptz, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_traffic_by_tenant(timestamptz, timestamptz) FROM anon;