
-- Allow members to self-check-in (insert their own attendance records)
CREATE POLICY "Members can self check-in" ON public.attendance_records
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.members WHERE members.id = member_id AND members.user_id = auth.uid()
  )
);
