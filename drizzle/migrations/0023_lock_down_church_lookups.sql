CREATE OR REPLACE FUNCTION public.get_upcoming_birthdays(_tenant_id uuid, _days_ahead integer DEFAULT 7)
 RETURNS TABLE(id uuid, first_name text, last_name text, date_of_birth date, phone text, email text, photo_url text, church_unit text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _today date := CURRENT_DATE;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR (auth.uid() IS NOT NULL AND (public.user_has_tenant_access(_tenant_id) OR public.has_role(auth.uid(), 'super_admin')))
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT m.id, m.first_name, m.last_name, m.date_of_birth, m.phone, m.email, m.photo_url, m.church_unit
  FROM public.members m
  WHERE m.tenant_id = _tenant_id
    AND m.date_of_birth IS NOT NULL
    AND (
      (
        EXTRACT(MONTH FROM _today) * 100 + EXTRACT(DAY FROM _today)
        <= EXTRACT(MONTH FROM _today + (_days_ahead || ' days')::interval) * 100 + EXTRACT(DAY FROM _today + (_days_ahead || ' days')::interval)
        AND EXTRACT(MONTH FROM m.date_of_birth) * 100 + EXTRACT(DAY FROM m.date_of_birth)
            BETWEEN EXTRACT(MONTH FROM _today) * 100 + EXTRACT(DAY FROM _today)
                AND EXTRACT(MONTH FROM _today + (_days_ahead || ' days')::interval) * 100 + EXTRACT(DAY FROM _today + (_days_ahead || ' days')::interval)
      )
      OR
      (
        EXTRACT(MONTH FROM _today) * 100 + EXTRACT(DAY FROM _today)
        > EXTRACT(MONTH FROM _today + (_days_ahead || ' days')::interval) * 100 + EXTRACT(DAY FROM _today + (_days_ahead || ' days')::interval)
        AND (
          EXTRACT(MONTH FROM m.date_of_birth) * 100 + EXTRACT(DAY FROM m.date_of_birth)
            >= EXTRACT(MONTH FROM _today) * 100 + EXTRACT(DAY FROM _today)
          OR EXTRACT(MONTH FROM m.date_of_birth) * 100 + EXTRACT(DAY FROM m.date_of_birth)
            <= EXTRACT(MONTH FROM _today + (_days_ahead || ' days')::interval) * 100 + EXTRACT(DAY FROM _today + (_days_ahead || ' days')::interval)
        )
      )
    )
  ORDER BY
    CASE
      WHEN EXTRACT(MONTH FROM m.date_of_birth) * 100 + EXTRACT(DAY FROM m.date_of_birth)
           >= EXTRACT(MONTH FROM _today) * 100 + EXTRACT(DAY FROM _today)
      THEN EXTRACT(MONTH FROM m.date_of_birth) * 100 + EXTRACT(DAY FROM m.date_of_birth)
      ELSE EXTRACT(MONTH FROM m.date_of_birth) * 100 + EXTRACT(DAY FROM m.date_of_birth) + 1300
    END;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_upcoming_birthdays(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_upcoming_birthdays(uuid, integer) TO authenticated, service_role;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN ('notify_all_users','next_invoice_number','next_student_number','sms_unit_price_for_tenant')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;