
-- Training completions table
CREATE TABLE public.training_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  training_type text NOT NULL,
  completion_date date NOT NULL DEFAULT CURRENT_DATE,
  certificate_number text UNIQUE NOT NULL,
  certificate_url text,
  issued_by uuid NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.training_completions ENABLE ROW LEVEL SECURITY;

-- Admins/leaders can manage
CREATE POLICY "Admins/leaders can manage training completions"
  ON public.training_completions FOR ALL TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role))
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role));

-- Members can view own completions
CREATE POLICY "Members can view own completions"
  ON public.training_completions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.members m WHERE m.id = training_completions.member_id AND m.user_id = auth.uid()
  ));

-- Certificate templates table
CREATE TABLE public.certificate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_type text UNIQUE NOT NULL,
  church_name text NOT NULL DEFAULT 'Winners Chapel International Cardiff',
  signatory_name text NOT NULL DEFAULT '',
  signatory_title text NOT NULL DEFAULT '',
  logo_url text,
  background_color text NOT NULL DEFAULT '#1a2d4d',
  accent_color text NOT NULL DEFAULT '#c5a028',
  custom_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY;

-- Admins can manage templates
CREATE POLICY "Admins can manage certificate templates"
  ON public.certificate_templates FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Authenticated can view templates
CREATE POLICY "Authenticated can view certificate templates"
  ON public.certificate_templates FOR SELECT TO authenticated
  USING (true);
