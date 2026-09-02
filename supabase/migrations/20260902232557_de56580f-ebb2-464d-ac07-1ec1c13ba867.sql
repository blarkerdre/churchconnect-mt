REVOKE EXECUTE ON FUNCTION public.traffic_live_days(timestamptz, timestamptz) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_traffic_summary(uuid, timestamptz, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_traffic_series(uuid, timestamptz, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_traffic_sources(uuid, timestamptz, timestamptz, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_traffic_devices(uuid, timestamptz, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_traffic_countries(uuid, timestamptz, timestamptz, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_traffic_top_pages(uuid, timestamptz, timestamptz, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_traffic_locations(uuid, timestamptz, timestamptz, integer) FROM anon;