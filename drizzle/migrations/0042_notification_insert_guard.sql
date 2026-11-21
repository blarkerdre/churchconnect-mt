CREATE OR REPLACE FUNCTION public.notifications_insert_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF public.has_role(auth.uid(), 'super_admin'::app_role) THEN RETURN NEW; END IF;
  IF NEW.tenant_id IS NULL THEN RAISE EXCEPTION 'Alerts must belong to a church'; END IF;
  IF NOT public.person_in_tenant(NEW.user_id, NEW.tenant_id) THEN
    RAISE EXCEPTION 'That person is not in this church';
  END IF;
  IF public.tenant_is_suspended(NEW.tenant_id) THEN
    RAISE EXCEPTION 'This church''s account is suspended. Messages can''t be sent until billing is sorted out.';
  END IF;
  NEW.title := left(regexp_replace(NEW.title, '<[^>]*>', '', 'g'), 200);
  NEW.message := left(regexp_replace(coalesce(NEW.message,''), '<[^>]*>', '', 'g'), 2000);
  IF EXISTS (SELECT 1 FROM public.notifications n
     WHERE n.user_id = NEW.user_id AND n.tenant_id = NEW.tenant_id
       AND n.title = NEW.title AND coalesce(n.message,'') = coalesce(NEW.message,'')
       AND n.created_at > now() - interval '24 hours') THEN
    RETURN NULL; -- identical alert already sent: drop silently
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notifications_insert_guard ON public.notifications;
CREATE TRIGGER trg_notifications_insert_guard BEFORE INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.notifications_insert_guard();