
CREATE TABLE public.data_export_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  member_id uuid NULL,
  reason text NULL,
  status text NOT NULL DEFAULT 'pending',
  review_note text NULL,
  reviewed_by uuid NULL,
  reviewed_at timestamptz NULL,
  approved_at timestamptz NULL,
  expires_at timestamptz NULL,
  downloaded_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT data_export_requests_status_chk
    CHECK (status IN ('pending','approved','rejected','downloaded','expired'))
);

CREATE INDEX idx_data_export_requests_tenant ON public.data_export_requests(tenant_id, status, created_at DESC);
CREATE INDEX idx_data_export_requests_user ON public.data_export_requests(user_id, tenant_id, created_at DESC);

GRANT SELECT, INSERT ON public.data_export_requests TO authenticated;
GRANT UPDATE (status, review_note, reviewed_by, reviewed_at, approved_at, expires_at, updated_at) ON public.data_export_requests TO authenticated;
GRANT ALL ON public.data_export_requests TO service_role;

ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;

-- Members: view their own requests
CREATE POLICY "Members view own export requests"
  ON public.data_export_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Tenant admins: view all in their tenant
CREATE POLICY "Admins view tenant export requests"
  ON public.data_export_requests FOR SELECT
  TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- Members: create their own request
CREATE POLICY "Members create own export requests"
  ON public.data_export_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND approved_at IS NULL
    AND expires_at IS NULL
    AND downloaded_at IS NULL
  );

-- Tenant admins: update (approve/reject) requests in their tenant
CREATE POLICY "Admins review export requests"
  ON public.data_export_requests FOR UPDATE
  TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

-- Trigger: prevent overlapping active requests, set approval timestamps, updated_at
CREATE OR REPLACE FUNCTION public.data_export_requests_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (
      SELECT 1 FROM public.data_export_requests
      WHERE tenant_id = NEW.tenant_id
        AND user_id = NEW.user_id
        AND (
          status = 'pending'
          OR (status = 'approved' AND (expires_at IS NULL OR expires_at > now()) AND downloaded_at IS NULL)
        )
    ) THEN
      RAISE EXCEPTION 'You already have an active data download request'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
    -- When admin flips to approved, stamp approval & 7-day expiry
    IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
      NEW.approved_at := now();
      NEW.expires_at := now() + interval '7 days';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_data_export_requests_insert
  BEFORE INSERT ON public.data_export_requests
  FOR EACH ROW EXECUTE FUNCTION public.data_export_requests_guard();

CREATE TRIGGER trg_data_export_requests_update
  BEFORE UPDATE ON public.data_export_requests
  FOR EACH ROW EXECUTE FUNCTION public.data_export_requests_guard();
