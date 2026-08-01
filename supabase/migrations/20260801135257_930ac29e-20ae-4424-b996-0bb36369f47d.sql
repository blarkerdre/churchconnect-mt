ALTER TABLE public.exam_subjects ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.lecturers ADD COLUMN IF NOT EXISTS lecturer_type text;
ALTER TABLE public.lecturers DROP CONSTRAINT IF EXISTS lecturers_lecturer_type_check;
ALTER TABLE public.lecturers ADD CONSTRAINT lecturers_lecturer_type_check CHECK (lecturer_type IS NULL OR lecturer_type IN ('internal','external'));