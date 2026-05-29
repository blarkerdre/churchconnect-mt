-- Platform alerts: super-admin broadcast overlays
CREATE TABLE public.platform_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  message TEXT NOT NULL,
  tenant_id UUID NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_alerts TO authenticated;
GRANT ALL ON public.platform_alerts TO service_role;

ALTER TABLE public.platform_alerts ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user whose tenant matches (or global broadcast), active and not expired
CREATE POLICY "Users see active alerts for their tenants"
ON public.platform_alerts
FOR SELECT
TO authenticated
USING (
  active = true
  AND (expires_at IS NULL OR expires_at > now())
  AND (
    tenant_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid() AND tm.tenant_id = platform_alerts.tenant_id
    )
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);

-- INSERT / UPDATE / DELETE: super_admin only
CREATE POLICY "Super admin insert alerts"
ON public.platform_alerts
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role) AND created_by = auth.uid());

CREATE POLICY "Super admin update alerts"
ON public.platform_alerts
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin delete alerts"
ON public.platform_alerts
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_platform_alerts_updated_at
BEFORE UPDATE ON public.platform_alerts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_alerts;
ALTER TABLE public.platform_alerts REPLICA IDENTITY FULL;