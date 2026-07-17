CREATE OR REPLACE FUNCTION public.get_teen_open_checkins(_qr_token uuid)
RETURNS TABLE(teen_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
BEGIN
  SELECT id INTO v_session_id FROM public.teen_attendance_sessions WHERE qr_token = _qr_token;
  IF v_session_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT r.teen_id
    FROM public.teen_attendance_records r
    WHERE r.session_id = v_session_id
      AND r.checked_out_at IS NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_teen_open_checkins(uuid) TO anon, authenticated;