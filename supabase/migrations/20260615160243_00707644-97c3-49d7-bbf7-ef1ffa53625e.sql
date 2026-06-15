
-- =========================================================
-- Inventory & Health & Safety Inspections
-- =========================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.inventory_condition AS ENUM ('good','fair','poor','out_of_service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.inventory_inspection_result AS ENUM ('pass','fail','needs_attention');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.inventory_response_result AS ENUM ('pass','fail','na');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- 1) inventory_categories
-- =========================================================
CREATE TABLE IF NOT EXISTS public.inventory_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  default_frequency_days integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_categories TO authenticated;
GRANT ALL ON public.inventory_categories TO service_role;
ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 2) inventory_items
-- =========================================================
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  category_id uuid REFERENCES public.inventory_categories(id) ON DELETE SET NULL,
  category text,
  location text,
  serial_number text,
  purchase_date date,
  condition public.inventory_condition NOT NULL DEFAULT 'good',
  notes text,
  photo_url text,
  requires_inspection boolean NOT NULL DEFAULT false,
  inspection_frequency_days integer,
  last_inspected_at timestamptz,
  next_due_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inv_items_tenant ON public.inventory_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inv_items_due ON public.inventory_items(tenant_id, next_due_at) WHERE requires_inspection;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 3) inventory_checklists
-- =========================================================
CREATE TABLE IF NOT EXISTS public.inventory_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  prompt text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inv_checklists_item ON public.inventory_checklists(item_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_checklists TO authenticated;
GRANT ALL ON public.inventory_checklists TO service_role;
ALTER TABLE public.inventory_checklists ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 4) inventory_inspections
-- =========================================================
CREATE TABLE IF NOT EXISTS public.inventory_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  inspected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  inspected_at timestamptz NOT NULL DEFAULT now(),
  overall_result public.inventory_inspection_result NOT NULL,
  notes text,
  signature_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inv_inspections_item ON public.inventory_inspections(item_id, inspected_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_inspections TO authenticated;
GRANT ALL ON public.inventory_inspections TO service_role;
ALTER TABLE public.inventory_inspections ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 5) inventory_inspection_responses
-- =========================================================
CREATE TABLE IF NOT EXISTS public.inventory_inspection_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  inspection_id uuid NOT NULL REFERENCES public.inventory_inspections(id) ON DELETE CASCADE,
  checklist_item_id uuid REFERENCES public.inventory_checklists(id) ON DELETE SET NULL,
  prompt_snapshot text NOT NULL,
  result public.inventory_response_result NOT NULL,
  comment text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inv_resp_inspection ON public.inventory_inspection_responses(inspection_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_inspection_responses TO authenticated;
GRANT ALL ON public.inventory_inspection_responses TO service_role;
ALTER TABLE public.inventory_inspection_responses ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- Helper: is_inventory_manager
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_inventory_manager(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _unit text;
  _is_admin boolean;
  _is_member boolean;
BEGIN
  IF _user_id IS NULL OR _tenant_id IS NULL THEN
    RETURN false;
  END IF;

  -- Super admin / tenant admin / tenant owner short-circuit
  IF public.is_admin(_user_id, _tenant_id) THEN
    RETURN true;
  END IF;

  -- Resolve configured Church Office unit name (tenant-specific, then global, default 'Church Office')
  SELECT COALESCE(
    (SELECT (value #>> '{}') FROM public.app_settings
       WHERE key = 'inventory.church_office_unit' AND tenant_id = _tenant_id LIMIT 1),
    (SELECT (value #>> '{}') FROM public.app_settings
       WHERE key = 'inventory.church_office_unit' AND tenant_id IS NULL LIMIT 1),
    'Church Office'
  ) INTO _unit;

  IF _unit IS NULL OR length(trim(_unit)) = 0 THEN
    _unit := 'Church Office';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.user_id = _user_id
      AND m.tenant_id = _tenant_id
      AND m.church_unit IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM unnest(string_to_array(m.church_unit, ',')) AS u
        WHERE lower(trim(u)) = lower(trim(_unit))
      )
  ) INTO _is_member;

  RETURN COALESCE(_is_member, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_inventory_manager(uuid, uuid) TO authenticated, service_role;

-- =========================================================
-- RLS Policies (all tables: full access to inventory managers)
-- =========================================================
CREATE POLICY "inv_categories_manage" ON public.inventory_categories
  FOR ALL TO authenticated
  USING (public.is_inventory_manager(auth.uid(), tenant_id))
  WITH CHECK (public.is_inventory_manager(auth.uid(), tenant_id));

CREATE POLICY "inv_items_manage" ON public.inventory_items
  FOR ALL TO authenticated
  USING (public.is_inventory_manager(auth.uid(), tenant_id))
  WITH CHECK (public.is_inventory_manager(auth.uid(), tenant_id));

CREATE POLICY "inv_checklists_manage" ON public.inventory_checklists
  FOR ALL TO authenticated
  USING (public.is_inventory_manager(auth.uid(), tenant_id))
  WITH CHECK (public.is_inventory_manager(auth.uid(), tenant_id));

CREATE POLICY "inv_inspections_manage" ON public.inventory_inspections
  FOR ALL TO authenticated
  USING (public.is_inventory_manager(auth.uid(), tenant_id))
  WITH CHECK (public.is_inventory_manager(auth.uid(), tenant_id));

CREATE POLICY "inv_inspection_responses_manage" ON public.inventory_inspection_responses
  FOR ALL TO authenticated
  USING (public.is_inventory_manager(auth.uid(), tenant_id))
  WITH CHECK (public.is_inventory_manager(auth.uid(), tenant_id));

-- =========================================================
-- Triggers: updated_at + recompute next_due_at on inspection insert
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_inv_items_updated ON public.inventory_items;
CREATE TRIGGER trg_inv_items_updated
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_inv_categories_updated ON public.inventory_categories;
CREATE TRIGGER trg_inv_categories_updated
  BEFORE UPDATE ON public.inventory_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.inventory_after_inspection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _freq integer;
BEGIN
  SELECT COALESCE(i.inspection_frequency_days, c.default_frequency_days)
    INTO _freq
  FROM public.inventory_items i
  LEFT JOIN public.inventory_categories c ON c.id = i.category_id
  WHERE i.id = NEW.item_id;

  UPDATE public.inventory_items
     SET last_inspected_at = NEW.inspected_at,
         next_due_at = CASE
           WHEN _freq IS NOT NULL AND _freq > 0
             THEN NEW.inspected_at + make_interval(days => _freq)
           ELSE NULL
         END,
         updated_at = now()
   WHERE id = NEW.item_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inv_after_inspection ON public.inventory_inspections;
CREATE TRIGGER trg_inv_after_inspection
  AFTER INSERT ON public.inventory_inspections
  FOR EACH ROW EXECUTE FUNCTION public.inventory_after_inspection();
