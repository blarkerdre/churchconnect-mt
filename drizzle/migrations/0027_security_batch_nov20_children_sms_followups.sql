-- 1) Text logs are only written by server functions.
DROP POLICY IF EXISTS "Admins/leaders can insert sms logs" ON public.sms_log;

-- 2) Children ministry workers can read guardian links but not create/alter them.
DROP POLICY IF EXISTS "Child guardians manage" ON public.child_guardians;
CREATE POLICY "Child guardians manage"
ON public.child_guardians
FOR ALL
TO authenticated
USING (
  public.is_admin(auth.uid(), tenant_id)
  OR public.is_child_primary_guardian(auth.uid(), child_id, tenant_id)
  OR public.is_child_co_parent(auth.uid(), child_id, tenant_id)
)
WITH CHECK (
  public.is_admin(auth.uid(), tenant_id)
  OR public.is_child_primary_guardian(auth.uid(), child_id, tenant_id)
  OR public.is_child_co_parent(auth.uid(), child_id, tenant_id)
);

-- 3) Check-in parent must belong to the child's church.
CREATE OR REPLACE FUNCTION public.checkin_child(_child_id uuid, _pin text, _parent_member_id uuid)
 RETURNS child_checkins
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _tenant uuid;
  _new_id uuid := gen_random_uuid();
  _row public.child_checkins;
  _child_name text;
BEGIN
  SELECT tenant_id, first_name || ' ' || last_name
    INTO _tenant, _child_name
  FROM public.children WHERE id = _child_id;
  IF _tenant IS NULL THEN RAISE EXCEPTION 'Child not found'; END IF;

  IF NOT (public.is_children_church_member(auth.uid(), _tenant) OR public.is_admin(auth.uid(), _tenant)) THEN
    RAISE EXCEPTION 'Only Children Church workers can check in';
  END IF;
  IF _pin IS NULL OR length(_pin) <> 6 THEN RAISE EXCEPTION 'PIN must be 6 digits'; END IF;

  IF _parent_member_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = _parent_member_id AND m.tenant_id = _tenant
  ) THEN
    RAISE EXCEPTION 'The parent must be a member of this church';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.child_checkins
    WHERE child_id = _child_id AND status = 'checked_in'
  ) THEN
    RAISE EXCEPTION '% is already checked in. Please pick them up first.', COALESCE(_child_name, 'Child');
  END IF;

  INSERT INTO public.child_checkins(
    id, tenant_id, child_id, service_date, dropoff_at, dropoff_worker_user_id,
    dropoff_parent_member_id, pin_code_hash, status
  ) VALUES (
    _new_id, _tenant, _child_id, CURRENT_DATE, now(), auth.uid(),
    _parent_member_id,
    encode(extensions.digest(_pin || '|' || _new_id::text, 'sha256'::text), 'hex'),
    'checked_in'
  ) RETURNING * INTO _row;

  RETURN _row;
END;
$function$;

-- 4) Scheduled follow-up messages always target the follow-up's own member.
CREATE OR REPLACE FUNCTION public.followup_message_lock_recipient()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _fu_member uuid;
  _fu_tenant uuid;
  _m record;
BEGIN
  SELECT f.member_id, f.tenant_id INTO _fu_member, _fu_tenant
  FROM public.followups f WHERE f.id = NEW.followup_id;

  IF _fu_tenant IS NULL OR NEW.tenant_id IS DISTINCT FROM _fu_tenant THEN
    RAISE EXCEPTION 'Follow-up does not belong to this church';
  END IF;
  IF _fu_member IS NULL THEN
    RAISE EXCEPTION 'Follow-up has no member to message';
  END IF;

  SELECT m.first_name, m.last_name, m.phone, m.email INTO _m
  FROM public.members m
  WHERE m.id = _fu_member AND m.tenant_id = _fu_tenant;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Follow-up member not found in this church';
  END IF;

  NEW.member_id := _fu_member;
  NEW.recipient_phone := _m.phone;
  NEW.recipient_email := _m.email;
  NEW.recipient_name := NULLIF(btrim(coalesce(_m.first_name, '') || ' ' || coalesce(_m.last_name, '')), '');
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.followup_message_lock_recipient() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_followup_message_lock_recipient ON public.followup_scheduled_messages;
CREATE TRIGGER trg_followup_message_lock_recipient
BEFORE INSERT OR UPDATE OF followup_id, tenant_id, member_id, recipient_phone, recipient_email, recipient_name
ON public.followup_scheduled_messages
FOR EACH ROW EXECUTE FUNCTION public.followup_message_lock_recipient();