-- 1. QC: one check per subject
DELETE FROM public.lecturer_qc_checks a
USING public.lecturer_qc_checks b
WHERE a.tenant_id = b.tenant_id
  AND a.exam_subject_id = b.exam_subject_id
  AND a.exam_subject_id IS NOT NULL
  AND a.created_at < b.created_at;

DROP INDEX IF EXISTS public.lecturer_qc_checks_lecturer_subject_uniq;
CREATE UNIQUE INDEX lecturer_qc_checks_subject_uniq
  ON public.lecturer_qc_checks (tenant_id, exam_subject_id)
  WHERE exam_subject_id IS NOT NULL;

-- 2. Scheduled open/close for Bible School attendance sessions
ALTER TABLE public.wofbi_attendance_sessions
  ADD COLUMN IF NOT EXISTS scheduled_open_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_close_at timestamptz;

CREATE OR REPLACE FUNCTION public.auto_manage_wofbi_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.wofbi_attendance_sessions
     SET status = 'open', updated_at = now()
   WHERE scheduled_open_at IS NOT NULL
     AND scheduled_open_at <= now()
     AND (scheduled_close_at IS NULL OR scheduled_close_at > now())
     AND status <> 'open';

  UPDATE public.wofbi_attendance_sessions
     SET status = 'closed', updated_at = now()
   WHERE scheduled_close_at IS NOT NULL
     AND scheduled_close_at <= now()
     AND status = 'open';
END;
$$;

-- 3. Live window awareness for the public QR listing
CREATE OR REPLACE FUNCTION public.list_open_wofbi_sessions(_tenant_slug text)
RETURNS TABLE(id uuid, title text, session_date date, qr_token uuid, course_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.id, s.title, s.session_date, s.qr_token,
         COALESCE(et.name, '') AS course_name
  FROM public.wofbi_attendance_sessions s
  JOIN public.tenants t ON t.id = s.tenant_id
  LEFT JOIN public.exam_titles et ON et.id = s.course_id
  WHERE t.slug = _tenant_slug
    AND t.is_archived IS NOT TRUE
    AND (s.scheduled_close_at IS NULL OR s.scheduled_close_at > now())
    AND (
      s.status = 'open'
      OR (s.scheduled_open_at IS NOT NULL AND s.scheduled_open_at <= now())
    )
  ORDER BY s.session_date DESC;
$$;
