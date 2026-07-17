
CREATE OR REPLACE FUNCTION public.list_open_teen_sessions(_tenant_slug text)
RETURNS TABLE(id uuid, title text, session_date date, start_time time, qr_token uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.title, s.session_date, s.start_time, s.qr_token
  FROM public.teen_attendance_sessions s
  JOIN public.tenants t ON t.id = s.tenant_id
  WHERE t.slug = _tenant_slug
    AND t.is_archived IS NOT TRUE
    AND s.status = 'open'
  ORDER BY s.session_date DESC, s.start_time NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.list_open_teen_sessions(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_open_wofbi_sessions(_tenant_slug text)
RETURNS TABLE(id uuid, title text, session_date date, qr_token uuid, course_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.title, s.session_date, s.qr_token,
         COALESCE(et.name, '') AS course_name
  FROM public.wofbi_attendance_sessions s
  JOIN public.tenants t ON t.id = s.tenant_id
  LEFT JOIN public.exam_titles et ON et.id = s.course_id
  WHERE t.slug = _tenant_slug
    AND t.is_archived IS NOT TRUE
    AND s.status = 'open'
  ORDER BY s.session_date DESC;
$$;

GRANT EXECUTE ON FUNCTION public.list_open_wofbi_sessions(text) TO anon, authenticated;
