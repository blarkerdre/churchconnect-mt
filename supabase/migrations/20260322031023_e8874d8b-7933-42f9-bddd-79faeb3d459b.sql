
-- Add pass_mark_percentage to exam_titles (course level)
ALTER TABLE public.exam_titles 
  ADD COLUMN IF NOT EXISTS pass_mark_percentage numeric NOT NULL DEFAULT 50;

-- Create exam_subjects table
CREATE TABLE public.exam_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES public.exam_titles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(course_id, name)
);

ALTER TABLE public.exam_subjects ENABLE ROW LEVEL SECURITY;

-- Admins can manage subjects
CREATE POLICY "Admins can manage exam subjects"
  ON public.exam_subjects FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Authenticated can view subjects
CREATE POLICY "Authenticated can view exam subjects"
  ON public.exam_subjects FOR SELECT TO authenticated
  USING (true);

-- Add subject_id to exam_questions
ALTER TABLE public.exam_questions 
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.exam_subjects(id) ON DELETE CASCADE;

-- Add subject_id to exam_attempts
ALTER TABLE public.exam_attempts 
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.exam_subjects(id);
