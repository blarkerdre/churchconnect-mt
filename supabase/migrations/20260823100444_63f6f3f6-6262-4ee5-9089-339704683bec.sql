DO $$
DECLARE
  _fn text;
  _def text;
  _new text;
BEGIN
  FOREACH _fn IN ARRAY ARRAY['auto_create_followup','notify_followup_reassignment','dispatch_web_push']
  LOOP
    SELECT pg_get_functiondef(p.oid) INTO _def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = _fn;

    _new := replace(
      _def,
      $q$'Authorization', 'Bearer ' || _service_key$q$,
      $q$'Authorization', 'Bearer ' || _service_key,
            'x-job-token', coalesce((SELECT token FROM public.internal_job_tokens WHERE name = 'scheduler' LIMIT 1), '')$q$
    );

    IF _new <> _def THEN
      EXECUTE _new;
    END IF;
  END LOOP;
END $$;