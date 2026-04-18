-- Enums
CREATE TYPE public.followup_referral_type AS ENUM ('unit_leader', 'home_cell_leader');
CREATE TYPE public.followup_referral_status AS ENUM ('pending', 'contacted', 'engaged', 'joined', 'declined', 'closed');

-- followup_referrals table
CREATE TABLE public.followup_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  followup_id uuid NOT NULL REFERENCES public.followups(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  referral_type public.followup_referral_type NOT NULL,
  target_unit_name text,
  target_wsf_centre_id uuid REFERENCES public.wsf_centres(id) ON DELETE SET NULL,
  assigned_leader_id uuid,
  status public.followup_referral_status NOT NULL DEFAULT 'pending',
  notes text,
  referred_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_followup_referrals_tenant ON public.followup_referrals(tenant_id);
CREATE INDEX idx_followup_referrals_followup ON public.followup_referrals(followup_id);
CREATE INDEX idx_followup_referrals_assigned ON public.followup_referrals(assigned_leader_id);
CREATE INDEX idx_followup_referrals_referred_by ON public.followup_referrals(referred_by);

-- followup_referral_updates table
CREATE TABLE public.followup_referral_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  referral_id uuid NOT NULL REFERENCES public.followup_referrals(id) ON DELETE CASCADE,
  author_id uuid,
  update_text text NOT NULL,
  status_change public.followup_referral_status,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_followup_referral_updates_referral ON public.followup_referral_updates(referral_id);
CREATE INDEX idx_followup_referral_updates_tenant ON public.followup_referral_updates(tenant_id);

-- Triggers for updated_at
CREATE TRIGGER trg_followup_referrals_updated_at
BEFORE UPDATE ON public.followup_referrals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.followup_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followup_referral_updates ENABLE ROW LEVEL SECURITY;

-- Helper: is_followup_team_member (unit leader of Follow-up OR member of Follow-up unit)
CREATE OR REPLACE FUNCTION public.is_followup_team_member(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.unit_leader_assignments
    WHERE user_id = _user_id AND tenant_id = _tenant_id
      AND lower(unit_name) IN ('follow-up', 'follow up', 'followup')
  ) OR EXISTS (
    SELECT 1 FROM public.members
    WHERE user_id = _user_id AND tenant_id = _tenant_id
      AND (lower(coalesce(church_unit,'')) LIKE '%follow-up%'
        OR lower(coalesce(church_unit,'')) LIKE '%follow up%')
  );
$$;

-- RLS: followup_referrals
CREATE POLICY "View referrals: admins, referrer, assigned leader, followup team"
ON public.followup_referrals FOR SELECT
USING (
  public.is_admin(auth.uid(), tenant_id)
  OR referred_by = auth.uid()
  OR assigned_leader_id = auth.uid()
  OR public.is_followup_team_member(auth.uid(), tenant_id)
);

CREATE POLICY "Insert referrals: admins or followup team"
ON public.followup_referrals FOR INSERT
WITH CHECK (
  user_belongs_to_tenant(auth.uid(), tenant_id)
  AND (
    public.is_admin(auth.uid(), tenant_id)
    OR public.is_followup_team_member(auth.uid(), tenant_id)
  )
  AND referred_by = auth.uid()
);

CREATE POLICY "Update referrals: admins, referrer, assigned leader"
ON public.followup_referrals FOR UPDATE
USING (
  public.is_admin(auth.uid(), tenant_id)
  OR referred_by = auth.uid()
  OR assigned_leader_id = auth.uid()
);

CREATE POLICY "Delete referrals: admins or referrer"
ON public.followup_referrals FOR DELETE
USING (
  public.is_admin(auth.uid(), tenant_id)
  OR referred_by = auth.uid()
);

-- RLS: followup_referral_updates
CREATE POLICY "View referral updates: admins, referrer, assigned leader, followup team"
ON public.followup_referral_updates FOR SELECT
USING (
  public.is_admin(auth.uid(), tenant_id)
  OR public.is_followup_team_member(auth.uid(), tenant_id)
  OR EXISTS (
    SELECT 1 FROM public.followup_referrals r
    WHERE r.id = referral_id
      AND (r.referred_by = auth.uid() OR r.assigned_leader_id = auth.uid())
  )
);

CREATE POLICY "Insert referral updates: assigned leader or admins"
ON public.followup_referral_updates FOR INSERT
WITH CHECK (
  user_belongs_to_tenant(auth.uid(), tenant_id)
  AND author_id = auth.uid()
  AND (
    public.is_admin(auth.uid(), tenant_id)
    OR EXISTS (
      SELECT 1 FROM public.followup_referrals r
      WHERE r.id = referral_id
        AND (r.assigned_leader_id = auth.uid() OR r.referred_by = auth.uid())
    )
  )
);

-- Trigger: when an update has a status_change, mirror it on the parent referral
CREATE OR REPLACE FUNCTION public.apply_referral_status_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status_change IS NOT NULL THEN
    UPDATE public.followup_referrals
    SET status = NEW.status_change, updated_at = now()
    WHERE id = NEW.referral_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_referral_status_change
AFTER INSERT ON public.followup_referral_updates
FOR EACH ROW EXECUTE FUNCTION public.apply_referral_status_change();

-- Trigger: notify assigned leader on new referral; notify referrer on each update
CREATE OR REPLACE FUNCTION public.notify_referral_created()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _member_name text;
  _target_label text;
BEGIN
  IF NEW.assigned_leader_id IS NULL THEN RETURN NEW; END IF;

  SELECT first_name || ' ' || last_name INTO _member_name
  FROM public.members WHERE id = NEW.member_id;
  _member_name := COALESCE(_member_name, 'A member');

  IF NEW.referral_type = 'unit_leader' THEN
    _target_label := COALESCE(NEW.target_unit_name, 'your unit');
  ELSE
    SELECT name INTO _target_label FROM public.wsf_centres WHERE id = NEW.target_wsf_centre_id;
    _target_label := COALESCE(_target_label, 'your home cell');
  END IF;

  INSERT INTO public.notifications (user_id, tenant_id, title, message, type, reference_id, reference_type)
  VALUES (
    NEW.assigned_leader_id, NEW.tenant_id,
    'New Sign-Post: ' || _member_name,
    _member_name || ' has been signposted to ' || _target_label || '. Please follow up.',
    'general', NEW.id::text, 'followup_referral'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_referral_created
AFTER INSERT ON public.followup_referrals
FOR EACH ROW EXECUTE FUNCTION public.notify_referral_created();

CREATE OR REPLACE FUNCTION public.notify_referral_update_added()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _referrer uuid;
  _member_name text;
BEGIN
  SELECT r.referred_by, m.first_name || ' ' || m.last_name
    INTO _referrer, _member_name
  FROM public.followup_referrals r
  LEFT JOIN public.members m ON m.id = r.member_id
  WHERE r.id = NEW.referral_id;

  IF _referrer IS NULL OR _referrer = NEW.author_id THEN RETURN NEW; END IF;

  INSERT INTO public.notifications (user_id, tenant_id, title, message, type, reference_id, reference_type)
  VALUES (
    _referrer, NEW.tenant_id,
    'Sign-Post Update: ' || COALESCE(_member_name, 'Referral'),
    CASE WHEN NEW.status_change IS NOT NULL
      THEN 'Status changed to ' || NEW.status_change::text || '. ' || left(NEW.update_text, 120)
      ELSE left(NEW.update_text, 160)
    END,
    'general', NEW.referral_id::text, 'followup_referral'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_referral_update_added
AFTER INSERT ON public.followup_referral_updates
FOR EACH ROW EXECUTE FUNCTION public.notify_referral_update_added();