
-- 1. Tighten user_leads_unit() — remove NULL tenant bypass
ALTER TABLE public.unit_leader_assignments ALTER COLUMN tenant_id SET NOT NULL;

CREATE OR REPLACE FUNCTION public.user_leads_unit(_user_id uuid, _unit_name text, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.unit_leader_assignments
    WHERE user_id = _user_id
      AND lower(unit_name) = lower(_unit_name)
      AND tenant_id = _tenant_id
  );
$function$;

-- 2. Tighten is_followup_team_member — exact unit match, not LIKE
CREATE OR REPLACE FUNCTION public.is_followup_team_member(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.unit_leader_assignments
    WHERE user_id = _user_id AND tenant_id = _tenant_id
      AND lower(unit_name) IN ('follow-up', 'follow up', 'followup')
  ) OR EXISTS (
    SELECT 1 FROM public.members
    WHERE user_id = _user_id AND tenant_id = _tenant_id
      AND lower(coalesce(church_unit,'')) IN ('follow-up', 'follow up', 'followup')
  );
$function$;

-- 3. Tighten email_send_log "Members can view own received emails" policy
-- Require the matching members row to be in the same tenant as the log row
DROP POLICY IF EXISTS "Members can view own received emails" ON public.email_send_log;
CREATE POLICY "Members can view own received emails"
ON public.email_send_log
FOR SELECT
USING (
  user_has_tenant_access(tenant_id) AND EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.email = email_send_log.recipient_email
      AND m.user_id = auth.uid()
      AND m.tenant_id = email_send_log.tenant_id
  )
);
