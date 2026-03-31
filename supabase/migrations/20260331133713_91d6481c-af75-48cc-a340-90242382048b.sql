
CREATE OR REPLACE FUNCTION public.get_upcoming_birthdays(_tenant_id uuid, _days_ahead int DEFAULT 7)
RETURNS TABLE(
  id uuid,
  first_name text,
  last_name text,
  date_of_birth date,
  phone text,
  email text,
  photo_url text,
  church_unit text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _today date := CURRENT_DATE;
BEGIN
  RETURN QUERY
  SELECT m.id, m.first_name, m.last_name, m.date_of_birth, m.phone, m.email, m.photo_url, m.church_unit
  FROM public.members m
  WHERE m.tenant_id = _tenant_id
    AND m.date_of_birth IS NOT NULL
    AND (
      -- Same year range
      (
        EXTRACT(MONTH FROM _today) * 100 + EXTRACT(DAY FROM _today)
        <= EXTRACT(MONTH FROM _today + (_days_ahead || ' days')::interval) * 100 + EXTRACT(DAY FROM _today + (_days_ahead || ' days')::interval)
        AND EXTRACT(MONTH FROM m.date_of_birth) * 100 + EXTRACT(DAY FROM m.date_of_birth)
            BETWEEN EXTRACT(MONTH FROM _today) * 100 + EXTRACT(DAY FROM _today)
                AND EXTRACT(MONTH FROM _today + (_days_ahead || ' days')::interval) * 100 + EXTRACT(DAY FROM _today + (_days_ahead || ' days')::interval)
      )
      OR
      -- Year wrap-around (e.g. Dec 28 looking 7 days ahead into Jan)
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
$$;
