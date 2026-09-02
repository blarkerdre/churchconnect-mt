CREATE OR REPLACE FUNCTION public.get_traffic_summary(_tenant_id uuid, _from timestamptz, _to timestamptz)
RETURNS TABLE(visitors bigint, page_views bigint, views_per_visit numeric, avg_duration_seconds numeric, bounce_rate numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
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
  ), visits AS (
    SELECT (r.created_at AT TIME ZONE 'UTC')::date AS day,
           r.visitor_id, r.session_id,
           count(*) AS views,
           EXTRACT(EPOCH FROM (max(r.created_at) - min(r.created_at))) AS duration
    FROM rows r GROUP BY 1, 2, 3
  ), live_daily AS (
    SELECT v.day,
           avg(v.duration)::numeric AS duration,
           (count(*) FILTER (WHERE v.views = 1))::numeric * 100 / NULLIF(count(*), 0) AS bounce
    FROM visits v GROUP BY v.day
  ), imported_daily AS (
    SELECT t.day, t.avg_duration_seconds AS duration, t.bounce_rate AS bounce
    FROM public.analytics_daily_totals t
    WHERE _tenant_id IS NULL
      AND t.day >= _from::date AND t.day < _to::date
      AND NOT EXISTS (SELECT 1 FROM live_daily l WHERE l.day = t.day)
  ), daily AS (
    SELECT * FROM live_daily UNION ALL SELECT * FROM imported_daily
  ), imported_totals AS (
    SELECT COALESCE(sum(t.visitors), 0)::numeric AS visitors,
           COALESCE(sum(t.page_views), 0)::numeric AS page_views
    FROM public.analytics_daily_totals t
    WHERE _tenant_id IS NULL
      AND t.day >= _from::date AND t.day < _to::date
      AND NOT EXISTS (SELECT 1 FROM live_daily l WHERE l.day = t.day)
  ), combined AS (
    SELECT (SELECT count(DISTINCT r.visitor_id) FROM rows r)::numeric + i.visitors AS visitors,
           (SELECT count(*) FROM rows r)::numeric + i.page_views AS page_views
    FROM imported_totals i
  )
  SELECT c.visitors::bigint,
         c.page_views::bigint,
         COALESCE(ROUND(c.page_views / NULLIF(c.visitors, 0), 2), 0),
         COALESCE((SELECT ROUND(avg(d.duration), 0) FROM daily d), 0),
         COALESCE((SELECT ROUND(avg(d.bounce), 0) FROM daily d), 0)
  FROM combined c;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_traffic_countries(_tenant_id uuid, _from timestamptz, _to timestamptz, _limit integer DEFAULT 10)
RETURNS TABLE(country text, visitors bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.can_read_traffic(_tenant_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  WITH live_agg AS (
    SELECT COALESCE(v.country, 'Unknown') AS country, count(DISTINCT v.visitor_id)::bigint AS visitors
    FROM public.analytics_page_views v
    WHERE v.created_at >= _from AND v.created_at < _to
      AND (_tenant_id IS NULL OR v.tenant_id = _tenant_id)
    GROUP BY 1
  ), imported AS (
    SELECT r.label AS country, r.value::bigint AS visitors
    FROM public.analytics_reference_lists r
    WHERE r.kind = 'country' AND _tenant_id IS NULL
      AND EXISTS (SELECT 1 FROM public.analytics_daily_totals t
                  WHERE t.day >= _from::date AND t.day < _to::date
                    AND NOT EXISTS (SELECT 1 FROM public.traffic_live_days(_from, _to) ld WHERE ld.day = t.day))
  )
  SELECT u.country, sum(u.visitors)::bigint
  FROM (SELECT * FROM live_agg UNION ALL SELECT * FROM imported) u
  GROUP BY u.country
  ORDER BY 2 DESC
  LIMIT GREATEST(_limit, 1);
END;
$$;