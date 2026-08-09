ALTER TABLE public.training_completions
  ADD COLUMN IF NOT EXISTS sent_to_student_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_by uuid;

UPDATE public.training_completions SET sent_to_student_at = created_at WHERE sent_to_student_at IS NULL;

DROP POLICY IF EXISTS "Members can view own completions" ON public.training_completions;
CREATE POLICY "Members can view own sent completions"
ON public.training_completions
FOR SELECT
TO authenticated
USING (
  user_has_tenant_access(tenant_id)
  AND sent_to_student_at IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM members m
    WHERE m.id = training_completions.member_id AND m.user_id = auth.uid()
  )
);