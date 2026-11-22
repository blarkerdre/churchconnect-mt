ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS email_added_by_leader boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.members_guard_email_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _trusted boolean;
BEGIN
  -- Server code / service role / sign-up triggers: trusted.
  IF _uid IS NULL THEN
    RETURN NEW;
  END IF;

  _trusted := public.is_admin(_uid, NEW.tenant_id)
           OR public.has_role(_uid, 'super_admin'::app_role)
           OR (TG_OP = 'UPDATE' AND OLD.user_id IS NOT NULL AND OLD.user_id = _uid);

  IF TG_OP = 'INSERT' THEN
    IF _trusted THEN
      NEW.email_added_by_leader := false;
    ELSE
      NEW.email_added_by_leader := coalesce(btrim(NEW.email), '') <> '';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF lower(coalesce(btrim(NEW.email), '')) IS DISTINCT FROM lower(coalesce(btrim(OLD.email), '')) THEN
    IF NOT _trusted THEN
      RAISE EXCEPTION 'Only a church admin or the member themselves can change a member''s email address'
        USING ERRCODE = '42501';
    END IF;
    NEW.email_added_by_leader := false;
  ELSIF NOT _trusted THEN
    NEW.email_added_by_leader := OLD.email_added_by_leader;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.members_guard_email_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_members_guard_email_change ON public.members;
CREATE TRIGGER trg_members_guard_email_change
BEFORE INSERT OR UPDATE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.members_guard_email_change();