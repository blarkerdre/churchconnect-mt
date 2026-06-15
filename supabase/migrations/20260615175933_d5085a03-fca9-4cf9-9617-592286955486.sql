
CREATE TABLE public.unit_task_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  unit_name text NOT NULL,
  service_type text NOT NULL,
  service_date date NOT NULL,
  title text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_unit_task_groups_tenant ON public.unit_task_groups(tenant_id);
CREATE INDEX idx_unit_task_groups_unit ON public.unit_task_groups(tenant_id, unit_name);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.unit_task_groups TO authenticated;
GRANT ALL ON public.unit_task_groups TO service_role;

ALTER TABLE public.unit_task_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "utg_select" ON public.unit_task_groups FOR SELECT
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.user_id = auth.uid() AND tm.tenant_id = unit_task_groups.tenant_id)
  OR public.user_leads_unit(auth.uid(), unit_task_groups.unit_name, unit_task_groups.tenant_id)
);

CREATE POLICY "utg_insert" ON public.unit_task_groups FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.is_admin(auth.uid(), unit_task_groups.tenant_id)
  OR public.user_leads_unit(auth.uid(), unit_task_groups.unit_name, unit_task_groups.tenant_id)
);

CREATE POLICY "utg_update" ON public.unit_task_groups FOR UPDATE
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.is_admin(auth.uid(), unit_task_groups.tenant_id)
  OR public.user_leads_unit(auth.uid(), unit_task_groups.unit_name, unit_task_groups.tenant_id)
);

CREATE POLICY "utg_delete" ON public.unit_task_groups FOR DELETE
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.is_admin(auth.uid(), unit_task_groups.tenant_id)
  OR public.user_leads_unit(auth.uid(), unit_task_groups.unit_name, unit_task_groups.tenant_id)
);

CREATE TRIGGER trg_unit_task_groups_updated_at
  BEFORE UPDATE ON public.unit_task_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.unit_tasks
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.unit_task_groups(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS service_type text,
  ADD COLUMN IF NOT EXISTS service_date date;

CREATE INDEX IF NOT EXISTS idx_unit_tasks_group ON public.unit_tasks(tenant_id, group_id);
