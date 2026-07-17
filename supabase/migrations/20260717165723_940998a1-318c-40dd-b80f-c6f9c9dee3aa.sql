CREATE OR REPLACE FUNCTION public.get_teen_session_by_token(_qr_token uuid)
RETURNS TABLE(id uuid, title text, session_date date, status text, tenant_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.title, s.session_date, s.status, s.tenant_id
  FROM public.teen_attendance_sessions s
  WHERE s.qr_token = _qr_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_teen_session_by_token(uuid) TO anon, authenticated;