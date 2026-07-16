CREATE OR REPLACE FUNCTION public.ensure_member_for_wofbi_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_member_id uuid;
  v_email text;
  v_existing_status text;
BEGIN
  IF NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;

  IF NEW.member_id IS NOT NULL THEN
    PERFORM 1 FROM public.members WHERE id = NEW.member_id AND tenant_id = NEW.tenant_id;
    IF FOUND THEN
      v_member_id := NEW.member_id;
    END IF;
  END IF;

  v_email := lower(trim(coalesce(NEW.email, '')));

  IF v_member_id IS NULL AND v_email <> '' THEN
    SELECT id INTO v_member_id
    FROM public.members
    WHERE tenant_id = NEW.tenant_id AND lower(email) = v_email
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_member_id IS NULL THEN
    INSERT INTO public.members (
      tenant_id, first_name, last_name, email, phone,
      membership_status, gdpr_consent, gdpr_consent_date
    ) VALUES (
      NEW.tenant_id,
      coalesce(NEW.first_name, 'Bible'),
      coalesce(NEW.last_name, 'School Student'),
      NULLIF(v_email, ''),
      NEW.phone,
      'Bible School',
      true,
      now()
    )
    RETURNING id INTO v_member_id;
  ELSE
    -- Promote Visitor -> Bible School on approval, but never overwrite other statuses
    SELECT membership_status INTO v_existing_status
    FROM public.members WHERE id = v_member_id;
    IF v_existing_status = 'Visitor' THEN
      UPDATE public.members SET membership_status = 'Bible School' WHERE id = v_member_id;
    END IF;
  END IF;

  IF NEW.member_id IS DISTINCT FROM v_member_id THEN
    NEW.member_id := v_member_id;
  END IF;

  IF NEW.course_id IS NOT NULL THEN
    INSERT INTO public.course_registrations (
      tenant_id, member_id, course_id, status, registered_at, approved_at, registration_origin
    )
    SELECT NEW.tenant_id, v_member_id, NEW.course_id, 'approved', now(), now(),
           coalesce(NEW.registration_origin, 'public_qr')
    WHERE NOT EXISTS (
      SELECT 1 FROM public.course_registrations
      WHERE tenant_id = NEW.tenant_id AND member_id = v_member_id AND course_id = NEW.course_id
    );
  END IF;

  RETURN NEW;
END;
$function$;