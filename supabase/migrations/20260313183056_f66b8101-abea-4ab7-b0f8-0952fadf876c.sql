-- Allow WSF leaders to update their own assigned centre
CREATE POLICY "WSF leaders can update own centre"
ON public.wsf_centres
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = wsf_centres.leader_id
    AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = wsf_centres.leader_id
    AND m.user_id = auth.uid()
  )
);

-- Allow WSF leaders to manage attendance for their own centre
CREATE POLICY "WSF leaders can manage own centre attendance"
ON public.wsf_attendance
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.wsf_centres wc
    JOIN public.members m ON m.id = wc.leader_id
    WHERE wc.id = wsf_attendance.centre_id
    AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.wsf_centres wc
    JOIN public.members m ON m.id = wc.leader_id
    WHERE wc.id = wsf_attendance.centre_id
    AND m.user_id = auth.uid()
  )
);