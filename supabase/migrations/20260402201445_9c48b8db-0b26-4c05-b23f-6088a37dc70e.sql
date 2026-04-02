CREATE TABLE public.event_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id),
  reaction text NOT NULL DEFAULT 'like',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

ALTER TABLE public.event_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own event reactions"
ON public.event_reactions FOR ALL TO authenticated
USING (auth.uid() = user_id AND user_has_tenant_access(tenant_id))
WITH CHECK (auth.uid() = user_id AND user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can view event reactions"
ON public.event_reactions FOR SELECT TO authenticated
USING (user_has_tenant_access(tenant_id));