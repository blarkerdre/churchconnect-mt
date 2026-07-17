
CREATE OR REPLACE FUNCTION public.crypt_pin(_pin text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT crypt(_pin, gen_salt('bf'));
$$;

GRANT EXECUTE ON FUNCTION public.crypt_pin(text) TO authenticated;
