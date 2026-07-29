DROP INDEX IF EXISTS public.lecturer_ratings_unique_per_subject;
CREATE UNIQUE INDEX lecturer_ratings_unique_per_subject ON public.lecturer_ratings (tenant_id, subject_id, submitted_by);