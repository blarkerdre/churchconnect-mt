ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS phone_added_by_leader boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.members_guard_phone_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _trusted boolean;
  _new_p text := right(regexp_replace(coalesce(NEW.phone, ''), '\D', '', 'g'), 9);
  _new_e text := right(regexp_replace(coalesce(NEW.emergency_contact_phone, ''), '\D', '', 'g'), 9);
  _old_p text;
  _old_e text;
  _changed boolean := false;
BEGIN
  -- Server code / service role / public sign-up: trusted.
  IF _uid IS NULL THEN
    RETURN NEW;
  END IF;

  _trusted := public.is_admin(_uid, NEW.tenant_id)
           OR public.has_role(_uid, 'super_admin'::app_role)
           OR (TG_OP = 'UPDATE' AND OLD.user_id IS NOT NULL AND OLD.user_id = _uid);

  IF TG_OP = 'INSERT' THEN
    IF _trusted THEN
      NEW.phone_added_by_leader := false;
    ELSE
      NEW.phone_added_by_leader := (_new_p <> '' OR _new_e <> '');
    END IF;
    RETURN NEW;
  END IF;

  _old_p := right(regexp_replace(coalesce(OLD.phone, ''), '\D', '', 'g'), 9);
  _old_e := right(regexp_replace(coalesce(OLD.emergency_contact_phone, ''), '\D', '', 'g'), 9);
  -- Clearing a number is harmless; only setting a new one counts as a change.
  _changed := (_new_p <> '' AND _new_p IS DISTINCT FROM _old_p)
           OR (_new_e <> '' AND _new_e IS DISTINCT FROM _old_e);

  IF _changed THEN
    IF NOT _trusted THEN
      RAISE EXCEPTION 'Only a church admin or the member themselves can change a member''s phone number'
        USING ERRCODE = '42501';
    END IF;
    NEW.phone_added_by_leader := false;
  ELSIF NOT _trusted THEN
    NEW.phone_added_by_leader := OLD.phone_added_by_leader;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.members_guard_phone_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_members_guard_phone_change ON public.members;
CREATE TRIGGER trg_members_guard_phone_change
BEFORE INSERT OR UPDATE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.members_guard_phone_change();