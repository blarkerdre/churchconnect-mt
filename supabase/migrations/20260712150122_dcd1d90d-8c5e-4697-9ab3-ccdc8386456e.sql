
-- =========================================================================
-- GDPR compliance migration
-- =========================================================================

-- 1. Extend existing tables --------------------------------------------------

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS consent_marketing BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_photos BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_pastoral_contact BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS consent_third_party_sharing BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_updated_at TIMESTAMPTZ;

ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS parent_consent_given_by UUID REFERENCES public.members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS parent_consent_ip_hash TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mfa_prompt_snoozed_until TIMESTAMPTZ;

-- 2. erasure_requests --------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.erasure_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','completed','legal_hold')),
  review_note TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  archive_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_erasure_requests_tenant ON public.erasure_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_erasure_requests_user ON public.erasure_requests(user_id);

GRANT SELECT, INSERT, UPDATE ON public.erasure_requests TO authenticated;
GRANT ALL ON public.erasure_requests TO service_role;

ALTER TABLE public.erasure_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "erasure_requests_owner_select"
  ON public.erasure_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "erasure_requests_owner_insert"
  ON public.erasure_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "erasure_requests_admin_select"
  ON public.erasure_requests FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid(), tenant_id));

CREATE POLICY "erasure_requests_admin_update"
  ON public.erasure_requests FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_admin(auth.uid(), tenant_id));

CREATE TRIGGER trg_erasure_requests_updated_at
  BEFORE UPDATE ON public.erasure_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. consent_events ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.consent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  consent_type TEXT NOT NULL,
  granted BOOLEAN NOT NULL,
  source TEXT NOT NULL DEFAULT 'unknown',
  ip_hash TEXT,
  user_agent TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consent_events_tenant ON public.consent_events(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_events_member ON public.consent_events(member_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_events_user ON public.consent_events(user_id, occurred_at DESC);

GRANT SELECT, INSERT ON public.consent_events TO authenticated;
GRANT ALL ON public.consent_events TO service_role;

ALTER TABLE public.consent_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consent_events_owner_select"
  ON public.consent_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "consent_events_admin_select"
  ON public.consent_events FOR SELECT TO authenticated
  USING (tenant_id IS NOT NULL AND public.is_admin(auth.uid(), tenant_id));

CREATE POLICY "consent_events_self_insert"
  ON public.consent_events FOR INSERT TO authenticated
  WITH CHECK (
    (user_id IS NULL OR user_id = auth.uid())
    AND (tenant_id IS NULL OR public.user_belongs_to_tenant(auth.uid(), tenant_id))
  );

-- Trigger: log consent changes on members
CREATE OR REPLACE FUNCTION public.log_member_consent_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.gdpr_consent THEN
      INSERT INTO public.consent_events (tenant_id, member_id, user_id, consent_type, granted, source)
      VALUES (NEW.tenant_id, NEW.id, NEW.user_id, 'privacy_policy', true, 'registration');
    END IF;
    IF NEW.consent_marketing THEN
      INSERT INTO public.consent_events (tenant_id, member_id, user_id, consent_type, granted, source)
      VALUES (NEW.tenant_id, NEW.id, NEW.user_id, 'marketing', true, 'registration');
    END IF;
    IF NEW.consent_photos THEN
      INSERT INTO public.consent_events (tenant_id, member_id, user_id, consent_type, granted, source)
      VALUES (NEW.tenant_id, NEW.id, NEW.user_id, 'photos', true, 'registration');
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF COALESCE(OLD.consent_marketing,false) IS DISTINCT FROM COALESCE(NEW.consent_marketing,false) THEN
      INSERT INTO public.consent_events (tenant_id, member_id, user_id, consent_type, granted, source)
      VALUES (NEW.tenant_id, NEW.id, NEW.user_id, 'marketing', NEW.consent_marketing, 'profile');
    END IF;
    IF COALESCE(OLD.consent_photos,false) IS DISTINCT FROM COALESCE(NEW.consent_photos,false) THEN
      INSERT INTO public.consent_events (tenant_id, member_id, user_id, consent_type, granted, source)
      VALUES (NEW.tenant_id, NEW.id, NEW.user_id, 'photos', NEW.consent_photos, 'profile');
    END IF;
    IF COALESCE(OLD.consent_pastoral_contact,true) IS DISTINCT FROM COALESCE(NEW.consent_pastoral_contact,true) THEN
      INSERT INTO public.consent_events (tenant_id, member_id, user_id, consent_type, granted, source)
      VALUES (NEW.tenant_id, NEW.id, NEW.user_id, 'pastoral_contact', NEW.consent_pastoral_contact, 'profile');
    END IF;
    IF COALESCE(OLD.consent_third_party_sharing,false) IS DISTINCT FROM COALESCE(NEW.consent_third_party_sharing,false) THEN
      INSERT INTO public.consent_events (tenant_id, member_id, user_id, consent_type, granted, source)
      VALUES (NEW.tenant_id, NEW.id, NEW.user_id, 'third_party_sharing', NEW.consent_third_party_sharing, 'profile');
    END IF;
    NEW.consent_updated_at := now();
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_members_consent_audit ON public.members;
CREATE TRIGGER trg_members_consent_audit
  AFTER INSERT OR UPDATE OF gdpr_consent, consent_marketing, consent_photos, consent_pastoral_contact, consent_third_party_sharing
  ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.log_member_consent_changes();

-- 4. retention_policies ------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  data_category TEXT NOT NULL,
  retention_days INTEGER NOT NULL,
  min_days INTEGER NOT NULL DEFAULT 30,
  max_days INTEGER NOT NULL DEFAULT 3650,
  enabled BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  last_run_at TIMESTAMPTZ,
  last_run_deleted_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, data_category)
);

GRANT SELECT, INSERT, UPDATE ON public.retention_policies TO authenticated;
GRANT ALL ON public.retention_policies TO service_role;

ALTER TABLE public.retention_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "retention_policies_admin_all"
  ON public.retention_policies FOR ALL TO authenticated
  USING (public.is_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_admin(auth.uid(), tenant_id));

CREATE TRIGGER trg_retention_policies_updated_at
  BEFORE UPDATE ON public.retention_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. public_endpoint_rate_limits --------------------------------------------

CREATE TABLE IF NOT EXISTS public.public_endpoint_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('hour', now()),
  count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ip_hash, endpoint, window_start)
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON public.public_endpoint_rate_limits(window_start);

GRANT ALL ON public.public_endpoint_rate_limits TO service_role;
-- No grants to anon/authenticated: service-role only.

ALTER TABLE public.public_endpoint_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies: locked to service_role only.

-- Rate-limit helper (SECURITY DEFINER, checked+incremented atomically)
CREATE OR REPLACE FUNCTION public.check_and_bump_rate_limit(
  _ip_hash TEXT,
  _endpoint TEXT,
  _limit INTEGER,
  _window_minutes INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _window_start TIMESTAMPTZ := date_trunc('minute', now()) - make_interval(mins => (extract(minute from now())::int % _window_minutes));
  _current INTEGER;
BEGIN
  INSERT INTO public.public_endpoint_rate_limits(ip_hash, endpoint, window_start, count)
  VALUES (_ip_hash, _endpoint, _window_start, 1)
  ON CONFLICT (ip_hash, endpoint, window_start)
  DO UPDATE SET count = public.public_endpoint_rate_limits.count + 1
  RETURNING count INTO _current;

  -- opportunistic cleanup of old rows
  DELETE FROM public.public_endpoint_rate_limits
  WHERE window_start < now() - interval '24 hours';

  RETURN _current <= _limit;
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_bump_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_bump_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO service_role;

-- 6. Seed default retention policies for existing tenants -------------------

INSERT INTO public.retention_policies (tenant_id, data_category, retention_days, min_days, max_days, description)
SELECT t.id, cat.data_category, cat.retention_days, cat.min_days, cat.max_days, cat.description
FROM public.tenants t
CROSS JOIN (VALUES
  ('first_timers_unconverted', 730, 90, 1825, 'First timers not converted to members'),
  ('pastoral_care_closed', 2190, 365, 3650, 'Closed pastoral care cases'),
  ('call_log', 730, 90, 2190, 'Call log entries'),
  ('sms_log', 730, 90, 2190, 'SMS delivery log'),
  ('email_send_log', 730, 90, 2190, 'Email delivery log'),
  ('notifications_read', 90, 30, 365, 'Read in-app notifications'),
  ('audit_log', 2190, 365, 3650, 'Audit log entries'),
  ('purged_data_archives', 30, 30, 90, 'Soft-deleted tenant archives')
) AS cat(data_category, retention_days, min_days, max_days, description)
ON CONFLICT (tenant_id, data_category) DO NOTHING;
