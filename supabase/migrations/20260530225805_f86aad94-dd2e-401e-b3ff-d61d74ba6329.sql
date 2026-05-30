
CREATE OR REPLACE FUNCTION public.user_leads_unit(_user_id uuid, _unit_name text, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.unit_leader_assignments
    WHERE user_id = _user_id
      AND lower(unit_name) = lower(_unit_name)
      AND (tenant_id IS NULL OR tenant_id = _tenant_id)
  );
$$;

-- Tables first (no policies yet) --
CREATE TABLE public.unit_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  unit_name text NOT NULL,
  title text NOT NULL,
  description text,
  due_date date,
  priority text NOT NULL DEFAULT 'Medium',
  status text NOT NULL DEFAULT 'Open',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_unit_tasks_tenant_unit ON public.unit_tasks(tenant_id, unit_name);
CREATE INDEX idx_unit_tasks_status ON public.unit_tasks(tenant_id, status);

CREATE TABLE public.unit_task_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.unit_tasks(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  user_id uuid,
  status text NOT NULL DEFAULT 'Pending',
  acknowledged_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, member_id)
);
CREATE INDEX idx_uta_task ON public.unit_task_assignments(task_id);
CREATE INDEX idx_uta_user ON public.unit_task_assignments(user_id);
CREATE INDEX idx_uta_tenant ON public.unit_task_assignments(tenant_id);

CREATE TABLE public.unit_task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.unit_tasks(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.unit_task_assignments(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_utc_task ON public.unit_task_comments(task_id);

-- Grants --
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unit_tasks TO authenticated;
GRANT ALL ON public.unit_tasks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unit_task_assignments TO authenticated;
GRANT ALL ON public.unit_task_assignments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unit_task_comments TO authenticated;
GRANT ALL ON public.unit_task_comments TO service_role;

-- RLS --
ALTER TABLE public.unit_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_task_comments ENABLE ROW LEVEL SECURITY;

-- unit_tasks policies --
CREATE POLICY "unit_tasks_select" ON public.unit_tasks FOR SELECT
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.user_id = auth.uid() AND tm.tenant_id = unit_tasks.tenant_id
      AND tm.role IN ('owner','admin'))
  OR public.user_leads_unit(auth.uid(), unit_tasks.unit_name, unit_tasks.tenant_id)
  OR EXISTS (SELECT 1 FROM public.unit_task_assignments a
    WHERE a.task_id = unit_tasks.id AND a.user_id = auth.uid())
);

CREATE POLICY "unit_tasks_insert" ON public.unit_tasks FOR INSERT
WITH CHECK (
  created_by = auth.uid() AND (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid() AND tm.tenant_id = unit_tasks.tenant_id
        AND tm.role IN ('owner','admin'))
    OR public.user_leads_unit(auth.uid(), unit_tasks.unit_name, unit_tasks.tenant_id)
  )
);

CREATE POLICY "unit_tasks_update" ON public.unit_tasks FOR UPDATE
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.user_id = auth.uid() AND tm.tenant_id = unit_tasks.tenant_id
      AND tm.role IN ('owner','admin'))
  OR public.user_leads_unit(auth.uid(), unit_tasks.unit_name, unit_tasks.tenant_id)
);

CREATE POLICY "unit_tasks_delete" ON public.unit_tasks FOR DELETE
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.user_id = auth.uid() AND tm.tenant_id = unit_tasks.tenant_id
      AND tm.role IN ('owner','admin'))
  OR public.user_leads_unit(auth.uid(), unit_tasks.unit_name, unit_tasks.tenant_id)
);

-- unit_task_assignments policies --
CREATE POLICY "uta_select" ON public.unit_task_assignments FOR SELECT
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.user_id = auth.uid() AND tm.tenant_id = unit_task_assignments.tenant_id
      AND tm.role IN ('owner','admin'))
  OR EXISTS (SELECT 1 FROM public.unit_tasks t
    WHERE t.id = unit_task_assignments.task_id
      AND public.user_leads_unit(auth.uid(), t.unit_name, t.tenant_id))
);

CREATE POLICY "uta_insert" ON public.unit_task_assignments FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.user_id = auth.uid() AND tm.tenant_id = unit_task_assignments.tenant_id
      AND tm.role IN ('owner','admin'))
  OR EXISTS (SELECT 1 FROM public.unit_tasks t
    WHERE t.id = unit_task_assignments.task_id
      AND public.user_leads_unit(auth.uid(), t.unit_name, t.tenant_id))
);

CREATE POLICY "uta_update" ON public.unit_task_assignments FOR UPDATE
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.user_id = auth.uid() AND tm.tenant_id = unit_task_assignments.tenant_id
      AND tm.role IN ('owner','admin'))
  OR EXISTS (SELECT 1 FROM public.unit_tasks t
    WHERE t.id = unit_task_assignments.task_id
      AND public.user_leads_unit(auth.uid(), t.unit_name, t.tenant_id))
);

CREATE POLICY "uta_delete" ON public.unit_task_assignments FOR DELETE
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.user_id = auth.uid() AND tm.tenant_id = unit_task_assignments.tenant_id
      AND tm.role IN ('owner','admin'))
  OR EXISTS (SELECT 1 FROM public.unit_tasks t
    WHERE t.id = unit_task_assignments.task_id
      AND public.user_leads_unit(auth.uid(), t.unit_name, t.tenant_id))
);

-- unit_task_comments policies --
CREATE POLICY "utc_select" ON public.unit_task_comments FOR SELECT
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.user_id = auth.uid() AND tm.tenant_id = unit_task_comments.tenant_id
      AND tm.role IN ('owner','admin'))
  OR EXISTS (SELECT 1 FROM public.unit_tasks t
    WHERE t.id = unit_task_comments.task_id
      AND public.user_leads_unit(auth.uid(), t.unit_name, t.tenant_id))
  OR EXISTS (SELECT 1 FROM public.unit_task_assignments a
    WHERE a.task_id = unit_task_comments.task_id AND a.user_id = auth.uid())
);

CREATE POLICY "utc_insert" ON public.unit_task_comments FOR INSERT
WITH CHECK (
  author_id = auth.uid() AND (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid() AND tm.tenant_id = unit_task_comments.tenant_id
        AND tm.role IN ('owner','admin'))
    OR EXISTS (SELECT 1 FROM public.unit_tasks t
      WHERE t.id = unit_task_comments.task_id
        AND public.user_leads_unit(auth.uid(), t.unit_name, t.tenant_id))
    OR EXISTS (SELECT 1 FROM public.unit_task_assignments a
      WHERE a.task_id = unit_task_comments.task_id AND a.user_id = auth.uid())
  )
);

CREATE POLICY "utc_delete" ON public.unit_task_comments FOR DELETE
USING (
  author_id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.user_id = auth.uid() AND tm.tenant_id = unit_task_comments.tenant_id
      AND tm.role IN ('owner','admin'))
  OR EXISTS (SELECT 1 FROM public.unit_tasks t
    WHERE t.id = unit_task_comments.task_id
      AND public.user_leads_unit(auth.uid(), t.unit_name, t.tenant_id))
);

-- Triggers --
CREATE TRIGGER trg_unit_tasks_updated BEFORE UPDATE ON public.unit_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_uta_updated BEFORE UPDATE ON public.unit_task_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime --
ALTER TABLE public.unit_tasks REPLICA IDENTITY FULL;
ALTER TABLE public.unit_task_assignments REPLICA IDENTITY FULL;
ALTER TABLE public.unit_task_comments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.unit_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.unit_task_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.unit_task_comments;
