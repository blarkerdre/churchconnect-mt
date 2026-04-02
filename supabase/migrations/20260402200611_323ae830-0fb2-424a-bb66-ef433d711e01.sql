
CREATE TABLE public.announcement_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id),
  reaction text NOT NULL DEFAULT 'like',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);

ALTER TABLE public.announcement_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own reactions"
ON public.announcement_reactions FOR ALL TO authenticated
USING (auth.uid() = user_id AND user_has_tenant_access(tenant_id))
WITH CHECK (auth.uid() = user_id AND user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can view reactions"
ON public.announcement_reactions FOR SELECT TO authenticated
USING (user_has_tenant_access(tenant_id));
