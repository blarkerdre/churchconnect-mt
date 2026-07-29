CREATE OR REPLACE FUNCTION public.is_registered_bible_school_student(_user_id uuid, _tenant_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.course_registrations cr
    JOIN public.members m ON m.id = cr.member_id
    WHERE cr.tenant_id = _tenant_id
      AND cr.course_id = _course_id
      AND cr.status = 'approved'
      AND cr.student_number IS NOT NULL
      AND m.tenant_id = _tenant_id
      AND m.user_id = _user_id
  )
$$;

DROP POLICY IF EXISTS "Students can insert own rating" ON public.lecturer_ratings;
CREATE POLICY "Students can insert own rating"
ON public.lecturer_ratings
FOR INSERT
TO authenticated
WITH CHECK (
  submitted_by = auth.uid()
  AND user_has_tenant_access(tenant_id)
  AND public.is_registered_bible_school_student(auth.uid(), tenant_id, course_id)
);

DROP POLICY IF EXISTS "Students can update own rating" ON public.lecturer_ratings;
CREATE POLICY "Students can update own rating"
ON public.lecturer_ratings
FOR UPDATE
TO authenticated
USING (
  submitted_by = auth.uid()
  AND user_has_tenant_access(tenant_id)
)
WITH CHECK (
  submitted_by = auth.uid()
  AND user_has_tenant_access(tenant_id)
  AND public.is_registered_bible_school_student(auth.uid(), tenant_id, course_id)
);