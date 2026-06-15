
ALTER TYPE pastoral_care_type ADD VALUE IF NOT EXISTS 'Life Event';

DO $$ BEGIN
  CREATE TYPE life_event_subtype AS ENUM ('childbirth','naming_dedication','marriage','bereavement');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE life_event_stage AS ENUM ('awaiting_leader','awaiting_altar_ministry','approved','rejected','completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.life_event_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  pastoral_care_id uuid REFERENCES public.pastoral_care(id) ON DELETE SET NULL,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  subtype life_event_subtype NOT NULL,
  subject_name text NOT NULL,
  event_date date,
  pastor_requested boolean NOT NULL DEFAULT false,
  notes text,
  approval_route text[] NOT NULL DEFAULT '{}',
  route_user_ids uuid[] NOT NULL DEFAULT '{}',
  stage life_event_stage NOT NULL DEFAULT 'awaiting_leader',
  stage1_approved_by uuid,
  stage1_approved_at timestamptz,
  stage1_note text,
  rejected_by uuid,
  rejected_at timestamptz,
  rejection_reason text,
  final_approved_by uuid,
  final_approved_at timestamptz,
  assigned_owner_id uuid,
  assigned_pastor_ids uuid[] NOT NULL DEFAULT '{}',
  completed_at timestamptz,
  completed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_life_event_requests_tenant ON public.life_event_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_life_event_requests_created_by ON public.life_event_requests(created_by);
CREATE INDEX IF NOT EXISTS idx_life_event_requests_stage ON public.life_event_requests(stage);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.life_event_requests TO authenticated;
GRANT ALL ON public.life_event_requests TO service_role;

DO $$ BEGIN
  CREATE TRIGGER trg_life_event_requests_updated_at
  BEFORE UPDATE ON public.life_event_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.is_altar_ministry_member(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _unit_name text;
  _member_units text;
BEGIN
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

  IF _member_units IS NOT NULL AND position(_unit_name in _member_units) > 0 THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.unit_leader_assignments
     WHERE user_id = _user_id AND tenant_id = _tenant_id AND lower(unit_name) = _unit_name
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_altar_ministry_leader(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _unit_name text;
BEGIN
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
$$;

ALTER TABLE public.life_event_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "life_events_insert_self"
ON public.life_event_requests FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND public.user_has_tenant_access(tenant_id));

CREATE POLICY "life_events_select"
ON public.life_event_requests FOR SELECT TO authenticated
USING (
  public.user_has_tenant_access(tenant_id) AND (
    created_by = auth.uid()
    OR auth.uid() = ANY(route_user_ids)
    OR (stage <> 'awaiting_leader' AND public.is_altar_ministry_member(auth.uid(), tenant_id))
    OR public.is_admin(auth.uid(), tenant_id)
  )
);

CREATE POLICY "life_events_update"
ON public.life_event_requests FOR UPDATE TO authenticated
USING (
  public.user_has_tenant_access(tenant_id) AND (
    auth.uid() = ANY(route_user_ids)
    OR public.is_altar_ministry_leader(auth.uid(), tenant_id)
    OR auth.uid() = assigned_owner_id
    OR public.is_admin(auth.uid(), tenant_id)
  )
)
WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "life_events_delete_admin"
ON public.life_event_requests FOR DELETE TO authenticated
USING (public.is_admin(auth.uid(), tenant_id) AND public.user_has_tenant_access(tenant_id));
