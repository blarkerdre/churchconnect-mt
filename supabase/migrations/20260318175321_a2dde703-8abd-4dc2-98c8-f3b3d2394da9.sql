
-- Drop the overly permissive SELECT policy
DROP POLICY "Authenticated users can view members" ON public.members;

-- Members can view their own record
CREATE POLICY "Members can view own record" ON public.members
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins and unit leaders can view all members
CREATE POLICY "Admins and leaders can view all members" ON public.members
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role));

-- WSF leaders can view members in their centre
CREATE POLICY "WSF leaders can view centre members" ON public.members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM wsf_centres wc
      JOIN members m ON m.id = wc.leader_id
      WHERE m.user_id = auth.uid()
        AND (members.wsf_centre_id = wc.id OR members.wsf_centre_id IS NULL)
    )
  );
