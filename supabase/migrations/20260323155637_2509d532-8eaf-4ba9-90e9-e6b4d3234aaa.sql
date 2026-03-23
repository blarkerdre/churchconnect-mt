CREATE POLICY "Anon can view active courses with open registration"
ON public.exam_titles
FOR SELECT
TO anon
USING (is_active = true AND registration_open = true);