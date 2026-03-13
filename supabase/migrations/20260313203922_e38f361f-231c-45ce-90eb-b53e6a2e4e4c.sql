
CREATE POLICY "WSF leaders can update members for own centre"
ON public.members
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.wsf_centres wc
    JOIN public.members m ON m.id = wc.leader_id
    WHERE m.user_id = auth.uid()
    AND (
      members.wsf_centre_id = wc.id
      OR members.wsf_centre_id IS NULL
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.wsf_centres wc
    JOIN public.members m ON m.id = wc.leader_id
    WHERE m.user_id = auth.uid()
    AND (
      members.wsf_centre_id = wc.id
      OR members.wsf_centre_id IS NULL
    )
  )
);
