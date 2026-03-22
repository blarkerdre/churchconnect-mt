
-- Create exam_titles table
CREATE TABLE public.exam_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_titles ENABLE ROW LEVEL SECURITY;

-- Admins can manage exam titles
CREATE POLICY "Admins can manage exam titles"
ON public.exam_titles
FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Authenticated can view exam titles
CREATE POLICY "Authenticated can view exam titles"
ON public.exam_titles
FOR SELECT
TO authenticated
USING (true);

-- Seed existing training types
INSERT INTO public.exam_titles (name) VALUES ('BFC'), ('BCC'), ('LCC'), ('LDC');

-- Add question_type column to exam_questions
ALTER TABLE public.exam_questions 
ADD COLUMN IF NOT EXISTS question_type text NOT NULL DEFAULT 'multiple_choice';
