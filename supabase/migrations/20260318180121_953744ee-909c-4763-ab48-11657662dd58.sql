
-- Fix WSF leader UPDATE policy: remove OR wsf_centre_id IS NULL
DROP POLICY "WSF leaders can update members for own centre" ON public.members;
CREATE POLICY "WSF leaders can update members for own centre" ON public.members
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM wsf_centres wc
      JOIN members m ON m.id = wc.leader_id
      WHERE m.user_id = auth.uid()
        AND members.wsf_centre_id = wc.id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM wsf_centres wc
      JOIN members m ON m.id = wc.leader_id
      WHERE m.user_id = auth.uid()
        AND members.wsf_centre_id = wc.id
    )
  );

-- Fix WSF leader SELECT policy: remove OR wsf_centre_id IS NULL
DROP POLICY "WSF leaders can view centre members" ON public.members;
CREATE POLICY "WSF leaders can view centre members" ON public.members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM wsf_centres wc
      JOIN members m ON m.id = wc.leader_id
      WHERE m.user_id = auth.uid()
        AND members.wsf_centre_id = wc.id
    )
  );
