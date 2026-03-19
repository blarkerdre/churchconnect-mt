-- Allow assigned follow-up unit members to update their assigned tasks
CREATE POLICY "Assigned users can update followups"
ON public.followups
FOR UPDATE
TO authenticated
USING (auth.uid() = assigned_to)
WITH CHECK (auth.uid() = assigned_to);

-- Allow assigned pastoral care unit members to update their assigned cases
CREATE POLICY "Assigned users can update pastoral care"
ON public.pastoral_care
FOR UPDATE
TO authenticated
USING (auth.uid() = assigned_to)
WITH CHECK (auth.uid() = assigned_to);