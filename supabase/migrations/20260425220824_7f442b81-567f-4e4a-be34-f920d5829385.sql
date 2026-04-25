-- DomiFort API tokens (global, super-admin only)
CREATE TABLE public.domifort_api_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  token_prefix text NOT NULL,
  signing_secret_hash text NOT NULL,
  signing_secret_prefix text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  request_count integer NOT NULL DEFAULT 0
);

CREATE INDEX idx_domifort_tokens_hash ON public.domifort_api_tokens(token_hash) WHERE is_active = true;

ALTER TABLE public.domifort_api_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage domifort tokens"
  ON public.domifort_api_tokens
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- DomiFort bookings (global, ingested via webhook)
CREATE TABLE public.domifort_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_ref text NOT NULL UNIQUE,
  status text,
  customer_name text,
  customer_email text,
  customer_phone text,
  service_type text,
  booking_start timestamptz,
  booking_end timestamptz,
  location text,
  amount_minor bigint,
  currency text,
  payload jsonb NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  source_token_id uuid REFERENCES public.domifort_api_tokens(id) ON DELETE SET NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_domifort_bookings_received_at ON public.domifort_bookings(received_at DESC);
CREATE INDEX idx_domifort_bookings_tenant ON public.domifort_bookings(tenant_id);

ALTER TABLE public.domifort_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins see all domifort bookings"
  ON public.domifort_bookings
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Tenant admins see their tenant's domifort bookings"
  ON public.domifort_bookings
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IS NOT NULL
    AND public.is_tenant_admin(auth.uid(), tenant_id)
  );

-- No insert/update/delete via app — service role only

CREATE TRIGGER trg_domifort_bookings_updated_at
  BEFORE UPDATE ON public.domifort_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- DomiFort ingest log (global, super-admin only)
CREATE TABLE public.domifort_ingest_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),
  token_id uuid REFERENCES public.domifort_api_tokens(id) ON DELETE SET NULL,
  auth_valid boolean NOT NULL DEFAULT false,
  signature_valid boolean NOT NULL DEFAULT false,
  status_code integer NOT NULL,
  external_ref text,
  error text,
  payload_size integer,
  ip text,
  user_agent text
);

CREATE INDEX idx_domifort_ingest_log_received_at ON public.domifort_ingest_log(received_at DESC);

ALTER TABLE public.domifort_ingest_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins read domifort ingest log"
  ON public.domifort_ingest_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));