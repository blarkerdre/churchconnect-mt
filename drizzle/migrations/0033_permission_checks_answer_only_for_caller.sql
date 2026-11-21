CREATE OR REPLACE FUNCTION public.rpc_probe_blocked(_fn text, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL
     AND _user_id IS DISTINCT FROM auth.uid()
     AND coalesce(current_setting('request.path', true), '') = '/rpc/' || _fn
$$;
REVOKE ALL ON FUNCTION public.rpc_probe_blocked(text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.can_manage_unit_task(_user_id uuid, _task_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('can_manage_unit_task', _user_id) THEN false ELSE (
SELECT (auth.uid() IS NULL OR _user_id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.unit_tasks t
      WHERE t.id = _task_id
        AND t.tenant_id = _tenant_id
        AND (
          public.has_role(_user_id, 'super_admin'::public.app_role)
          OR public.is_admin(_user_id, t.tenant_id)
          OR public.user_leads_unit(_user_id, t.unit_name, t.tenant_id)
        )
    )
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.count_pending_join_requests_for_user(_user_id uuid, _tenant_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('count_pending_join_requests_for_user', _user_id) THEN 0 ELSE (
SELECT COUNT(*)::integer
  FROM public.unit_join_requests r
  WHERE _user_id = auth.uid()
    AND r.tenant_id = _tenant_id
    AND r.status = 'pending'
    AND (
      public.is_admin(_user_id, _tenant_id)
      OR (r.request_type = 'unit' AND public.is_unit_leader_for_session(_user_id, r.unit_name, _tenant_id))
      OR (r.request_type = 'home_cell' AND public.is_home_cell_leader_for_centre(_user_id, r.wsf_centre_id, _tenant_id))
    )
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('has_role', _user_id) THEN false ELSE (
SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role AND tenant_id = _tenant_id
  )
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('has_role', _user_id) THEN false ELSE (
SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (
        _role <> 'super_admin'::app_role
        OR tenant_id IS NULL
      )
  )
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('is_admin', _user_id) THEN false ELSE (
SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'super_admin')
      AND (tenant_id = _tenant_id OR role = 'super_admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE user_id = _user_id AND tenant_id = _tenant_id
      AND role IN ('owner', 'admin')
  )
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.is_altar_ministry_leader(_user_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _unit_name text;
BEGIN
  IF public.rpc_probe_blocked('is_altar_ministry_leader', _user_id) THEN RETURN false; END IF;
  IF _user_id IS NULL OR _tenant_id IS NULL THEN RETURN false; END IF;
  SELECT lower(trim(both '"' from coalesce(value::text,'')))
    INTO _unit_name
    FROM public.app_settings
   WHERE key = 'pastoral.altar_ministry_unit' AND tenant_id = _tenant_id
   LIMIT 1;
  IF _unit_name IS NULL OR _unit_name = '' THEN _unit_name := 'altar ministry'; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.unit_leader_assignments
     WHERE user_id = _user_id AND tenant_id = _tenant_id AND lower(unit_name) = _unit_name
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_altar_ministry_member(_user_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _unit_name text;
  _member_units text;
  _token text;
BEGIN
  IF public.rpc_probe_blocked('is_altar_ministry_member', _user_id) THEN RETURN false; END IF;
  IF _user_id IS NULL OR _tenant_id IS NULL THEN RETURN false; END IF;

  SELECT lower(trim(both '"' from coalesce(value::text,'')))
    INTO _unit_name
    FROM public.app_settings
   WHERE key = 'pastoral.altar_ministry_unit' AND tenant_id = _tenant_id
   LIMIT 1;
  IF _unit_name IS NULL OR _unit_name = '' THEN _unit_name := 'altar ministry'; END IF;

  SELECT lower(coalesce(church_unit,''))
    INTO _member_units
    FROM public.members
   WHERE user_id = _user_id AND tenant_id = _tenant_id
   LIMIT 1;

  IF _member_units IS NOT NULL AND _member_units <> '' THEN
    FOREACH _token IN ARRAY regexp_split_to_array(_member_units, '\s*[,;|]\s*') LOOP
      IF trim(_token) = _unit_name THEN
        RETURN true;
      END IF;
    END LOOP;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.unit_leader_assignments
     WHERE user_id = _user_id AND tenant_id = _tenant_id AND lower(unit_name) = _unit_name
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_assigned_referral_leader_for_member(_user_id uuid, _member_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('is_assigned_referral_leader_for_member', _user_id) THEN false ELSE (
SELECT EXISTS (
    SELECT 1
    FROM public.followup_referrals r
    WHERE r.assigned_leader_id = _user_id
      AND r.member_id = _member_id
      AND r.tenant_id = _tenant_id
      AND r.status <> 'closed'
  )
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.is_assigned_unit_task(_user_id uuid, _task_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('is_assigned_unit_task', _user_id) THEN false ELSE (
SELECT EXISTS (
    SELECT 1
    FROM public.unit_task_assignments a
    WHERE a.task_id = _task_id
      AND a.tenant_id = _tenant_id
      AND a.user_id = _user_id
  )
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.is_child_active_today(_user_id uuid, _child_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('is_child_active_today', _user_id) THEN false ELSE (
SELECT EXISTS (
    SELECT 1
    FROM public.child_checkins cc
    WHERE cc.child_id = _child_id
      AND cc.tenant_id = _tenant_id
      AND cc.service_date = CURRENT_DATE
      AND public.is_children_church_member(_user_id, _tenant_id)
  )
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.is_child_co_parent(_user_id uuid, _child_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('is_child_co_parent', _user_id) THEN false ELSE (
SELECT EXISTS (
    SELECT 1
    FROM public.child_guardians cg
    JOIN public.members m ON m.id = cg.member_id
    WHERE cg.child_id = _child_id
      AND cg.tenant_id = _tenant_id
      AND m.user_id = _user_id
      AND m.tenant_id = _tenant_id
  )
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.is_child_primary_guardian(_user_id uuid, _child_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('is_child_primary_guardian', _user_id) THEN false ELSE (
SELECT EXISTS (
    SELECT 1
    FROM public.children c
    JOIN public.members m ON m.id = c.primary_guardian_member_id
    WHERE c.id = _child_id
      AND c.tenant_id = _tenant_id
      AND m.tenant_id = _tenant_id
      AND m.user_id = _user_id
  )
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.is_children_church_leader(_user_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('is_children_church_leader', _user_id) THEN false ELSE (
SELECT EXISTS (
    SELECT 1 FROM public.unit_leader_assignments ula
    WHERE ula.user_id = _user_id
      AND ula.tenant_id = _tenant_id
      AND lower(btrim(ula.unit_name)) IN (
        'children church','childrens church','children''s church',
        'children','children ministry','childrens ministry','children''s ministry'
      )
  )
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.is_children_church_member(_user_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('is_children_church_member', _user_id) THEN false ELSE (
SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = _user_id
      AND m.tenant_id = _tenant_id
      AND EXISTS (
        SELECT 1
        FROM unnest(string_to_array(coalesce(m.church_unit, ''), ',')) AS u(name)
        WHERE lower(btrim(u.name)) IN (
          'children church','childrens church','children''s church',
          'children','children ministry','childrens ministry','children''s ministry'
        )
      )
  )
  OR EXISTS (
    SELECT 1 FROM public.unit_leader_assignments ula
    WHERE ula.user_id = _user_id
      AND ula.tenant_id = _tenant_id
      AND lower(btrim(ula.unit_name)) IN (
        'children church','childrens church','children''s church',
        'children','children ministry','childrens ministry','children''s ministry'
      )
  )
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.is_followup_team_member(_user_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('is_followup_team_member', _user_id) THEN false ELSE (
SELECT EXISTS (
    SELECT 1 FROM public.unit_leader_assignments
    WHERE user_id = _user_id AND tenant_id = _tenant_id
      AND lower(unit_name) IN ('follow-up', 'follow up', 'followup')
  ) OR EXISTS (
    SELECT 1 FROM public.members
    WHERE user_id = _user_id AND tenant_id = _tenant_id
      AND lower(coalesce(church_unit,'')) IN ('follow-up', 'follow up', 'followup')
  )
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.is_home_cell_leader_for_centre(_user_id uuid, _centre_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('is_home_cell_leader_for_centre', _user_id) THEN false ELSE (
SELECT EXISTS (
    SELECT 1
    FROM public.wsf_centres wc
    JOIN public.members m ON m.id = wc.leader_id OR m.id = wc.host_member_id
    WHERE wc.id = _centre_id
      AND wc.tenant_id = _tenant_id
      AND m.user_id = _user_id
      AND m.tenant_id = _tenant_id
  )
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.is_inventory_manager(_user_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _unit text;
  _is_admin boolean;
  _is_member boolean;
BEGIN
  IF public.rpc_probe_blocked('is_inventory_manager', _user_id) THEN RETURN false; END IF;
  IF _user_id IS NULL OR _tenant_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_admin(_user_id, _tenant_id) THEN
    RETURN true;
  END IF;

  SELECT COALESCE(
    (SELECT (value #>> '{}') FROM public.app_settings
       WHERE key = 'inventory.church_office_unit' AND tenant_id = _tenant_id LIMIT 1),
    (SELECT (value #>> '{}') FROM public.app_settings
       WHERE key = 'inventory.church_office_unit' AND tenant_id IS NULL LIMIT 1),
    'Church Office'
  ) INTO _unit;

  IF _unit IS NULL OR length(trim(_unit)) = 0 THEN
    _unit := 'Church Office';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.user_id = _user_id
      AND m.tenant_id = _tenant_id
      AND m.church_unit IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM unnest(string_to_array(m.church_unit, ',')) AS u
        WHERE lower(trim(u)) = lower(trim(_unit))
      )
  ) INTO _is_member;

  RETURN COALESCE(_is_member, false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_registered_bible_school_student(_user_id uuid, _tenant_id uuid, _course_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('is_registered_bible_school_student', _user_id) THEN false ELSE (
SELECT EXISTS (
    SELECT 1
    FROM public.course_registrations cr
    JOIN public.members m ON m.id = cr.member_id
    WHERE cr.tenant_id = _tenant_id
      AND cr.course_id = _course_id
      AND cr.status = 'approved'
      AND cr.student_number IS NOT NULL
      AND m.tenant_id = _tenant_id
      AND m.user_id = _user_id
  )
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.is_reports_officer(_user_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('is_reports_officer', _user_id) THEN false ELSE (
SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'reports_officer'::app_role
      AND tenant_id = _tenant_id
      AND _tenant_id IS NOT NULL
  )
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.is_teens_unit_leader(_user_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('is_teens_unit_leader', _user_id) THEN false ELSE (
SELECT EXISTS (
    SELECT 1 FROM public.unit_leader_assignments ula
    WHERE ula.user_id = _user_id
      AND ula.tenant_id = _tenant_id
      AND lower(btrim(ula.unit_name)) IN ('teens','teen','teenagers','youth','teens ministry','teen ministry','teens church','teen church')
  )
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.is_teens_unit_member(_user_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('is_teens_unit_member', _user_id) THEN false ELSE (
SELECT
    public.is_teens_unit_leader(_user_id, _tenant_id)
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = _user_id
        AND m.tenant_id = _tenant_id
        AND m.church_unit IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM unnest(string_to_array(m.church_unit, ',')) AS u(name)
          WHERE lower(btrim(u.name)) IN ('teens','teen','teenagers','youth','teens ministry','teen ministry','teens church','teen church')
        )
    )
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('is_tenant_admin', _user_id) THEN false ELSE (
SELECT EXISTS (
    SELECT 1
    FROM public.tenant_memberships
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND role IN ('owner', 'admin')
  )
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.is_tenant_owner(_user_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('is_tenant_owner', _user_id) THEN false ELSE (
SELECT EXISTS (SELECT 1 FROM public.tenant_memberships WHERE user_id = _user_id AND tenant_id = _tenant_id AND role = 'owner')
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.is_training_rep_leader(_user_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('is_training_rep_leader', _user_id) THEN false ELSE (
SELECT EXISTS (
    SELECT 1 FROM public.unit_leader_assignments ula
    WHERE ula.user_id = _user_id
      AND ula.tenant_id = _tenant_id
      AND lower(btrim(ula.unit_name)) IN ('training rep','training reps','training')
  )
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.is_training_rep_member(_user_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('is_training_rep_member', _user_id) THEN false ELSE (
SELECT EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.user_id = _user_id
      AND m.tenant_id = _tenant_id
      AND m.church_unit IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM regexp_split_to_table(m.church_unit, ',') u
        WHERE lower(btrim(u)) = 'training rep'
      )
  )
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.is_transport_unit_member(_user_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('is_transport_unit_member', _user_id) THEN false ELSE (
SELECT EXISTS (
    SELECT 1 FROM public.members
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND church_unit ILIKE '%transport%'
  )
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.is_unit_leader_for_member(_user_id uuid, _church_unit text, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('is_unit_leader_for_member', _user_id) THEN false ELSE (
SELECT EXISTS (
    SELECT 1
    FROM public.unit_leader_assignments ula
    JOIN unnest(string_to_array(COALESCE(_church_unit, ''), ',')) AS t(unit) ON true
    WHERE ula.user_id = _user_id
      AND ula.tenant_id = _tenant_id
      AND lower(btrim(t.unit)) = lower(btrim(ula.unit_name))
      AND btrim(t.unit) <> ''
  )
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.is_unit_leader_for_session(_user_id uuid, _unit text, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('is_unit_leader_for_session', _user_id) THEN false ELSE (
SELECT EXISTS (
    SELECT 1 FROM public.unit_leader_assignments ula
    WHERE ula.user_id = _user_id
      AND ula.tenant_id = _tenant_id
      AND lower(ula.unit_name) = lower(COALESCE(_unit, ''))
  )
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.is_wsf_leader_for_centre(_user_id uuid, _centre_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('is_wsf_leader_for_centre', _user_id) THEN false ELSE (
SELECT EXISTS (
    SELECT 1
    FROM public.wsf_centres wc
    JOIN public.members m ON m.id = wc.leader_id
    WHERE wc.id = _centre_id
      AND m.user_id = _user_id
      AND m.tenant_id = wc.tenant_id
      AND public.user_has_tenant_access(wc.tenant_id)
  )
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.is_wsf_leader_for_session(_user_id uuid, _unit text, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('is_wsf_leader_for_session', _user_id) THEN false ELSE (
SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = 'wsf_leader'
      AND ur.tenant_id = _tenant_id
  )
  AND EXISTS (
    SELECT 1
    FROM members m
    JOIN wsf_centres wc
      ON wc.id = m.wsf_centre_id
     AND wc.tenant_id = m.tenant_id
    WHERE m.user_id = _user_id
      AND m.tenant_id = _tenant_id
      AND (wc.leader_id = m.id OR wc.host_member_id = m.id)
      AND _unit IS NOT NULL
      AND wc.name = _unit
  )
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.person_in_tenant(_user_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('person_in_tenant', _user_id) THEN false ELSE (
SELECT EXISTS (SELECT 1 FROM public.tenant_memberships WHERE user_id = _user_id AND tenant_id = _tenant_id)
      OR EXISTS (SELECT 1 FROM public.members WHERE user_id = _user_id AND tenant_id = _tenant_id)
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.task_is_in_user_unit(_user_id uuid, _task_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('task_is_in_user_unit', _user_id) THEN false ELSE (
SELECT EXISTS (
    SELECT 1
    FROM public.unit_tasks t
    WHERE t.id = _task_id
      AND t.tenant_id = _tenant_id
      AND public.user_is_unit_member(_user_id, t.unit_name, _tenant_id)
  )
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(_user_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('user_belongs_to_tenant', _user_id) THEN false ELSE (
SELECT EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE user_id = _user_id AND tenant_id = _tenant_id
  )
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.user_has_verified_mfa(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('user_has_verified_mfa', _user_id) THEN false ELSE (
SELECT EXISTS (
    SELECT 1 FROM auth.mfa_factors f
    WHERE f.user_id = _user_id AND f.status = 'verified'
  )
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.user_is_followup_unit_member(_user_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('user_is_followup_unit_member', _user_id) THEN false ELSE (
SELECT EXISTS (
    SELECT 1
    FROM public.members m
    JOIN public.church_units cu
      ON cu.tenant_id = m.tenant_id
     AND lower(cu.name) = lower(m.church_unit)
    WHERE m.user_id = _user_id
      AND m.tenant_id = _tenant_id
      AND cu.is_active = true
      AND (
        cu.name ILIKE '%follow%up%'
        OR cu.name ILIKE 'follow up'
        OR cu.name ILIKE 'followup'
      )
  )
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.user_is_unit_member(_user_id uuid, _unit_name text, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('user_is_unit_member', _user_id) THEN false ELSE (
SELECT EXISTS (
    SELECT 1
    FROM public.members m,
         unnest(string_to_array(coalesce(m.church_unit, ''), ',')) AS unit
    WHERE m.user_id = _user_id
      AND m.tenant_id = _tenant_id
      AND lower(btrim(unit)) = lower(btrim(_unit_name))
  )
  ) END
$function$;

CREATE OR REPLACE FUNCTION public.user_leads_unit(_user_id uuid, _unit_name text, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.rpc_probe_blocked('user_leads_unit', _user_id) THEN false ELSE (
SELECT EXISTS (
    SELECT 1 FROM public.unit_leader_assignments
    WHERE user_id = _user_id
      AND lower(unit_name) = lower(_unit_name)
      AND tenant_id = _tenant_id
  )
  ) END
$function$;