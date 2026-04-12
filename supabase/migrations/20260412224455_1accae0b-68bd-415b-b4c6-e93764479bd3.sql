CREATE TABLE public.testimonies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  member_name text,
  title text NOT NULL,
  situation text NOT NULL,
  action text NOT NULL,
  god_did text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.testimonies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own testimonies"
  ON public.testimonies FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND user_has_tenant_access(tenant_id));

CREATE POLICY "Admins can view all testimonies"
  ON public.testimonies FOR SELECT TO authenticated
  USING (is_admin(auth.uid(), tenant_id));

CREATE POLICY "Service role can insert testimonies"
  ON public.testimonies FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_testimonies_user_tenant ON public.testimonies (user_id, tenant_id);