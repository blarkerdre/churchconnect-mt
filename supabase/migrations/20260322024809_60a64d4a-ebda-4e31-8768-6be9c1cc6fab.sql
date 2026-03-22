
-- Create exam_sessions table
CREATE TABLE public.exam_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft',
  pass_mark_percentage numeric NOT NULL DEFAULT 50,
  started_at timestamptz,
  ended_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage exam sessions"
ON public.exam_sessions FOR ALL TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Authenticated can view exam sessions"
ON public.exam_sessions FOR SELECT TO authenticated
USING (true);

-- Create exam_session_courses join table
CREATE TABLE public.exam_session_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.exam_sessions(id) ON DELETE CASCADE NOT NULL,
  exam_title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE(session_id, exam_title)
);

ALTER TABLE public.exam_session_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage session courses"
ON public.exam_session_courses FOR ALL TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Authenticated can view session courses"
ON public.exam_session_courses FOR SELECT TO authenticated
USING (true);

-- Add session_id to exam_attempts
ALTER TABLE public.exam_attempts
ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.exam_sessions(id);

-- Fix selected_answer column type from char to text for fill_in_gap and drag_and_drop
ALTER TABLE public.exam_answers ALTER COLUMN selected_answer TYPE text;

-- Fix correct_answer column type from char to text for fill_in_gap and drag_and_drop
ALTER TABLE public.exam_questions ALTER COLUMN correct_answer TYPE text;
