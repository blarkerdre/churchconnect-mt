-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view registrations" ON public.event_registrations;

-- Users can only see their own registrations; admins/leaders covered by existing ALL policy
CREATE POLICY "Users can view own registrations"
  ON public.event_registrations FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = event_registrations.member_id
        AND m.user_id = auth.uid()
    )
    OR is_admin(auth.uid())
    OR has_role(auth.uid(), 'unit_leader')
  );