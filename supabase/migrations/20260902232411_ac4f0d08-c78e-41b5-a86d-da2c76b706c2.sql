CREATE TABLE IF NOT EXISTS public.analytics_daily_totals (
  day date PRIMARY KEY,
  visitors bigint NOT NULL DEFAULT 0,
  page_views bigint NOT NULL DEFAULT 0,
  views_per_visit numeric NOT NULL DEFAULT 0,
  avg_duration_seconds numeric NOT NULL DEFAULT 0,
  bounce_rate numeric NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'lovable',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.analytics_daily_totals TO authenticated;
GRANT ALL ON public.analytics_daily_totals TO service_role;
ALTER TABLE public.analytics_daily_totals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins read daily totals" ON public.analytics_daily_totals;
CREATE POLICY "Super admins read daily totals"
  ON public.analytics_daily_totals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TABLE IF NOT EXISTS public.analytics_reference_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  label text NOT NULL,
  value bigint NOT NULL DEFAULT 0,
  period_start date,
  period_end date,
  source text NOT NULL DEFAULT 'lovable',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, label, source)
);

GRANT SELECT ON public.analytics_reference_lists TO authenticated;
GRANT ALL ON public.analytics_reference_lists TO service_role;
ALTER TABLE public.analytics_reference_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins read reference lists" ON public.analytics_reference_lists;
CREATE POLICY "Super admins read reference lists"
  ON public.analytics_reference_lists FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Days that already have first-party tracking data
CREATE OR REPLACE FUNCTION public.traffic_live_days(_from timestamptz, _to timestamptz)
RETURNS TABLE(day date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT DISTINCT (v.created_at AT TIME ZONE 'UTC')::date
  FROM public.analytics_page_views v
  WHERE v.created_at >= _from AND v.created_at < _to;
$$;

CREATE OR REPLACE FUNCTION public.get_traffic_series(_tenant_id uuid, _from timestamptz, _to timestamptz)
RETURNS TABLE(day date, visitors bigint, page_views bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.can_read_traffic(_tenant_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  WITH days AS (
    SELECT d::date AS day FROM generate_series(_from::date, (_to::date - 1), interval '1 day') d
  ), live AS (
    SELECT (v.created_at AT TIME ZONE 'UTC')::date AS day,
           count(DISTINCT v.visitor_id)::bigint AS visitors,
           count(*)::bigint AS page_views
    FROM public.analytics_page_views v
    WHERE v.created_at >= _from AND v.created_at < _to
      AND (_tenant_id IS NULL OR v.tenant_id = _tenant_id)
    GROUP BY 1
  ), live_days AS (
    SELECT * FROM public.traffic_live_days(_from, _to)
  )
  SELECT d.day,
         COALESCE(l.visitors,
                  CASE WHEN _tenant_id IS NULL AND NOT EXISTS (SELECT 1 FROM live_days ld WHERE ld.day = d.day)
                       THEN t.visitors END, 0)::bigint,
         COALESCE(l.page_views,
                  CASE WHEN _tenant_id IS NULL AND NOT EXISTS (SELECT 1 FROM live_days ld WHERE ld.day = d.day)
                       THEN t.page_views END, 0)::bigint
  FROM days d
  LEFT JOIN live l ON l.day = d.day
  LEFT JOIN public.analytics_daily_totals t ON t.day = d.day
  ORDER BY d.day;
END;
$$;

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
    -- a visit = one visitor's session
    SELECT r.visitor_id, r.session_id,
           count(*) AS views,
           EXTRACT(EPOCH FROM (max(r.created_at) - min(r.created_at))) AS duration
    FROM rows r GROUP BY r.visitor_id, r.session_id
  ), live AS (
    SELECT (SELECT count(DISTINCT r.visitor_id) FROM rows r)::numeric AS visitors,
           (SELECT count(*) FROM rows r)::numeric AS page_views,
           COALESCE((SELECT sum(v.duration) FROM visits v), 0)::numeric AS duration_total,
           COALESCE((SELECT count(*) FROM visits), 0)::numeric AS visit_count,
           COALESCE((SELECT count(*) FROM visits v WHERE v.views = 1), 0)::numeric AS bounced
  ), imported AS (
    SELECT COALESCE(sum(t.visitors), 0)::numeric AS visitors,
           COALESCE(sum(t.page_views), 0)::numeric AS page_views,
           COALESCE(sum(t.avg_duration_seconds * t.visitors), 0)::numeric AS duration_total,
           COALESCE(sum(t.visitors), 0)::numeric AS visit_count,
           COALESCE(sum(t.bounce_rate / 100.0 * t.visitors), 0)::numeric AS bounced
    FROM public.analytics_daily_totals t
    WHERE _tenant_id IS NULL
      AND t.day >= _from::date AND t.day < _to::date
      AND NOT EXISTS (SELECT 1 FROM public.traffic_live_days(_from, _to) ld WHERE ld.day = t.day)
  ), combined AS (
    SELECT l.visitors + i.visitors AS visitors,
           l.page_views + i.page_views AS page_views,
           l.duration_total + i.duration_total AS duration_total,
           l.visit_count + i.visit_count AS visit_count,
           l.bounced + i.bounced AS bounced
    FROM live l CROSS JOIN imported i
  )
  SELECT c.visitors::bigint,
         c.page_views::bigint,
         COALESCE(ROUND(c.page_views / NULLIF(c.visitors, 0), 2), 0),
         COALESCE(ROUND(c.duration_total / NULLIF(c.visit_count, 0), 0), 0),
         COALESCE(ROUND(c.bounced * 100 / NULLIF(c.visit_count, 0), 0), 0)
  FROM combined c;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_traffic_sources(_tenant_id uuid, _from timestamptz, _to timestamptz, _limit integer DEFAULT 10)
RETURNS TABLE(source text, visitors bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.can_read_traffic(_tenant_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  WITH live AS (
    SELECT CASE
             WHEN v.referrer IS NULL OR v.referrer = '' THEN 'Direct'
             ELSE regexp_replace(regexp_replace(v.referrer, '^https?://', ''), '^www\.', '')
           END AS src,
           v.visitor_id
    FROM public.analytics_page_views v
    WHERE v.created_at >= _from AND v.created_at < _to
      AND (_tenant_id IS NULL OR v.tenant_id = _tenant_id)
  ), live_agg AS (
    SELECT split_part(l.src, '/', 1) AS src, count(DISTINCT l.visitor_id)::bigint AS visitors
    FROM live l GROUP BY 1
  ), imported AS (
    SELECT r.label AS src, r.value::bigint AS visitors
    FROM public.analytics_reference_lists r
    WHERE r.kind = 'source' AND _tenant_id IS NULL
      AND EXISTS (SELECT 1 FROM public.analytics_daily_totals t
                  WHERE t.day >= _from::date AND t.day < _to::date
                    AND NOT EXISTS (SELECT 1 FROM public.traffic_live_days(_from, _to) ld WHERE ld.day = t.day))
  ), unioned AS (
    SELECT src, sum(visitors)::bigint AS visitors FROM (
      SELECT * FROM live_agg UNION ALL SELECT * FROM imported
    ) u GROUP BY src
  )
  SELECT u.src, u.visitors FROM unioned u ORDER BY u.visitors DESC LIMIT GREATEST(_limit, 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_traffic_devices(_tenant_id uuid, _from timestamptz, _to timestamptz)
RETURNS TABLE(device text, visitors bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.can_read_traffic(_tenant_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  WITH live_agg AS (
    SELECT COALESCE(v.device_type, 'unknown') AS device, count(DISTINCT v.visitor_id)::bigint AS visitors
    FROM public.analytics_page_views v
    WHERE v.created_at >= _from AND v.created_at < _to
      AND (_tenant_id IS NULL OR v.tenant_id = _tenant_id)
    GROUP BY 1
  ), imported AS (
    SELECT r.label AS device, r.value::bigint AS visitors
    FROM public.analytics_reference_lists r
    WHERE r.kind = 'device' AND _tenant_id IS NULL
      AND EXISTS (SELECT 1 FROM public.analytics_daily_totals t
                  WHERE t.day >= _from::date AND t.day < _to::date
                    AND NOT EXISTS (SELECT 1 FROM public.traffic_live_days(_from, _to) ld WHERE ld.day = t.day))
  )
  SELECT u.device, sum(u.visitors)::bigint
  FROM (SELECT * FROM live_agg UNION ALL SELECT * FROM imported) u
  GROUP BY u.device
  ORDER BY 2 DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_traffic_top_pages(_tenant_id uuid, _from timestamptz, _to timestamptz, _limit integer DEFAULT 15)
RETURNS TABLE(path text, visitors bigint, page_views bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.can_read_traffic(_tenant_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  WITH live_agg AS (
    SELECT v.path AS path, count(DISTINCT v.visitor_id)::bigint AS visitors, count(*)::bigint AS page_views
    FROM public.analytics_page_views v
    WHERE v.created_at >= _from AND v.created_at < _to
      AND (_tenant_id IS NULL OR v.tenant_id = _tenant_id)
    GROUP BY v.path
  ), imported AS (
    SELECT r.label AS path, 0::bigint AS visitors, r.value::bigint AS page_views
    FROM public.analytics_reference_lists r
    WHERE r.kind = 'page' AND _tenant_id IS NULL
      AND EXISTS (SELECT 1 FROM public.analytics_daily_totals t
                  WHERE t.day >= _from::date AND t.day < _to::date
                    AND NOT EXISTS (SELECT 1 FROM public.traffic_live_days(_from, _to) ld WHERE ld.day = t.day))
  )
  SELECT u.path, sum(u.visitors)::bigint, sum(u.page_views)::bigint
  FROM (SELECT * FROM live_agg UNION ALL SELECT * FROM imported) u
  GROUP BY u.path
  ORDER BY 3 DESC
  LIMIT GREATEST(_limit, 1);
END;
$$;