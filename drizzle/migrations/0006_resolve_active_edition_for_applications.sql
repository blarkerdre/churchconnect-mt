CREATE OR REPLACE FUNCTION public.resolve_exam_session_for_course(_tenant_id uuid, _course_id uuid, _on_date date)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT s.id
  FROM public.exam_sessions s
  JOIN public.exam_session_courses sc ON sc.session_id = s.id
  JOIN public.exam_titles t ON lower(t.name) = lower(sc.exam_title)
  WHERE s.tenant_id = _tenant_id
    AND t.id = _course_id
    AND (
      (_on_date IS NOT NULL AND s.starts_on IS NOT NULL AND s.ends_on IS NOT NULL
        AND _on_date BETWEEN s.starts_on AND s.ends_on)
      OR (_on_date IS NULL AND lower(coalesce(s.status,'')) IN ('active','open'))
    )
  ORDER BY (lower(coalesce(s.status,'')) IN ('active','open')) DESC, s.started_at DESC NULLS LAST, s.starts_on DESC NULLS LAST, s.created_at DESC
  LIMIT 1;
$function$;

UPDATE public.wofbi_applications a
SET session_id = public.resolve_exam_session_for_course(a.tenant_id, a.course_id, NULL)
WHERE a.session_id IS NULL AND a.course_id IS NOT NULL
  AND public.resolve_exam_session_for_course(a.tenant_id, a.course_id, NULL) IS NOT NULL;