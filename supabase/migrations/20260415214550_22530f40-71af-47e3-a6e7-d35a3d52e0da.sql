
CREATE TABLE public.app_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rating integer NOT NULL,
  comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);

-- Validation trigger for rating 1-5
CREATE OR REPLACE FUNCTION public.validate_feedback_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rating < 1 OR NEW.rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_validate_feedback_rating
BEFORE INSERT OR UPDATE ON public.app_feedback
FOR EACH ROW EXECUTE FUNCTION public.validate_feedback_rating();

ALTER TABLE public.app_feedback ENABLE ROW LEVEL SECURITY;

-- Members can view their own feedback
CREATE POLICY "Users can view own feedback"
ON public.app_feedback FOR SELECT
TO authenticated
USING (auth.uid() = user_id AND user_has_tenant_access(tenant_id));

-- Members can insert their own feedback
CREATE POLICY "Users can insert own feedback"
ON public.app_feedback FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND user_has_tenant_access(tenant_id));

-- Members can update their own feedback
CREATE POLICY "Users can update own feedback"
ON public.app_feedback FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND user_has_tenant_access(tenant_id))
WITH CHECK (auth.uid() = user_id AND user_has_tenant_access(tenant_id));

-- Admins can view all feedback in their tenant
CREATE POLICY "Admins can view all tenant feedback"
ON public.app_feedback FOR SELECT
TO authenticated
USING (is_admin(auth.uid(), tenant_id));
