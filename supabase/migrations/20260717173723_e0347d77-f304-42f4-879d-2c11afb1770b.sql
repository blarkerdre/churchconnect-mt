
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.crypt_pin(_pin text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT extensions.crypt(_pin, extensions.gen_salt('bf'));
$$;
GRANT EXECUTE ON FUNCTION public.crypt_pin(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.teen_self_set_pin(_enrolment_id uuid, _pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE r public.teen_self_enrolments%ROWTYPE;
BEGIN
  IF _pin IS NULL OR length(_pin) < 4 OR length(_pin) > 6 OR _pin !~ '^[0-9]+$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_pin');
  END IF;
  SELECT * INTO r FROM public.teen_self_enrolments WHERE id = _enrolment_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF r.status <> 'approved' THEN RETURN jsonb_build_object('ok', false, 'error', 'not_approved'); END IF;
  IF r.expires_at < now() THEN RETURN jsonb_build_object('ok', false, 'error', 'expired'); END IF;

  UPDATE public.teens
    SET self_pin_hash = extensions.crypt(_pin, extensions.gen_salt('bf')),
        self_pin_set_at = now(),
        updated_at = now()
    WHERE id = r.teen_id;

  UPDATE public.teen_self_enrolments SET status = 'used' WHERE id = _enrolment_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.teen_self_set_pin(uuid, text) TO anon, authenticated;
