CREATE TABLE IF NOT EXISTS public.analytics_page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  session_id text NOT NULL,
  path text NOT NULL,
  referrer text,
  country text,
  city text,
  device_type text,
  is_authenticated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.analytics_page_views TO authenticated;
GRANT ALL ON public.analytics_page_views TO service_role;

ALTER TABLE public.analytics_page_views ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_apv_created_at ON public.analytics_page_views (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apv_tenant_created ON public.analytics_page_views (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apv_session ON public.analytics_page_views (session_id);

CREATE POLICY "apv_super_admin_read" ON public.analytics_page_views
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "apv_tenant_admin_read" ON public.analytics_page_views
  FOR SELECT TO authenticated
  USING (tenant_id IS NOT NULL AND public.is_admin(auth.uid(), tenant_id));

CREATE OR REPLACE FUNCTION public.can_read_traffic(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'super_admin'::app_role)
      OR (_tenant_id IS NOT NULL AND public.is_admin(auth.uid(), _tenant_id));
$$;

CREATE OR REPLACE FUNCTION public.get_traffic_summary(_tenant_id uuid, _from timestamptz, _to timestamptz)
RETURNS TABLE (visitors bigint, page_views bigint, views_per_visit numeric, avg_duration_seconds numeric, bounce_rate numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_read_traffic(_tenant_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  WITH rows AS (
    SELECT * FROM public.analytics_page_views v
    WHERE v.created_at >= _from AND v.created_at < _to
      AND (_tenant_id IS NULL OR v.tenant_id = _tenant_id)
  ), sessions AS (
    SELECT r.session_id,
           count(*) AS views,
           EXTRACT(EPOCH FROM (max(r.created_at) - min(r.created_at))) AS duration
    FROM rows r GROUP BY r.session_id
  )
  SELECT
    (SELECT count(DISTINCT r.visitor_id) FROM rows r),
    (SELECT count(*) FROM rows r),
    COALESCE(ROUND(AVG(s.views)::numeric, 2), 0),
    COALESCE(ROUND(AVG(s.duration)::numeric, 0), 0),
    COALESCE(ROUND((count(*) FILTER (WHERE s.views = 1))::numeric * 100 / NULLIF(count(*), 0), 0), 0)
  FROM sessions s;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_traffic_series(_tenant_id uuid, _from timestamptz, _to timestamptz)
RETURNS TABLE (day date, visitors bigint, page_views bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_read_traffic(_tenant_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  SELECT d::date,
         COALESCE(count(DISTINCT v.visitor_id), 0)::bigint,
         COALESCE(count(v.id), 0)::bigint
  FROM generate_series(_from::date, (_to::date - 1), interval '1 day') d
  LEFT JOIN public.analytics_page_views v
    ON v.created_at >= d AND v.created_at < d + interval '1 day'
   AND (_tenant_id IS NULL OR v.tenant_id = _tenant_id)
  GROUP BY d
  ORDER BY d;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_traffic_locations(_tenant_id uuid, _from timestamptz, _to timestamptz, _limit integer DEFAULT 15)
RETURNS TABLE (country text, city text, visitors bigint, page_views bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_read_traffic(_tenant_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  SELECT COALESCE(v.country, 'Unknown'), COALESCE(v.city, 'Unknown'),
         count(DISTINCT v.visitor_id)::bigint, count(*)::bigint
  FROM public.analytics_page_views v
  WHERE v.created_at >= _from AND v.created_at < _to
    AND (_tenant_id IS NULL OR v.tenant_id = _tenant_id)
  GROUP BY 1, 2
  ORDER BY 3 DESC
  LIMIT GREATEST(_limit, 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_traffic_top_pages(_tenant_id uuid, _from timestamptz, _to timestamptz, _limit integer DEFAULT 15)
RETURNS TABLE (path text, visitors bigint, page_views bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_read_traffic(_tenant_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  SELECT v.path, count(DISTINCT v.visitor_id)::bigint, count(*)::bigint
  FROM public.analytics_page_views v
  WHERE v.created_at >= _from AND v.created_at < _to
    AND (_tenant_id IS NULL OR v.tenant_id = _tenant_id)
  GROUP BY v.path
  ORDER BY 3 DESC
  LIMIT GREATEST(_limit, 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_traffic_by_tenant(_from timestamptz, _to timestamptz)
RETURNS TABLE (tenant_id uuid, tenant_name text, visitors bigint, page_views bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  SELECT v.tenant_id, COALESCE(t.name, 'Public / unassigned'),
         count(DISTINCT v.visitor_id)::bigint, count(*)::bigint
  FROM public.analytics_page_views v
  LEFT JOIN public.tenants t ON t.id = v.tenant_id
  WHERE v.created_at >= _from AND v.created_at < _to
  GROUP BY v.tenant_id, t.name
  ORDER BY 4 DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_old_analytics_page_views()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.analytics_page_views WHERE created_at < now() - interval '12 months';
$$;

REVOKE ALL ON FUNCTION public.purge_old_analytics_page_views() FROM public;
GRANT EXECUTE ON FUNCTION public.purge_old_analytics_page_views() TO service_role;