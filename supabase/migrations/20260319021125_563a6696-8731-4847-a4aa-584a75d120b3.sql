
DROP POLICY "Authenticated can view wsf attendance" ON wsf_attendance;

CREATE POLICY "Admins/leaders can view wsf attendance"
  ON wsf_attendance FOR SELECT
  TO authenticated
  USING (
    is_admin(auth.uid())
    OR has_role(auth.uid(), 'unit_leader')
    OR has_role(auth.uid(), 'wsf_leader')
    OR EXISTS (
      SELECT 1 FROM wsf_centres wc
      JOIN members m ON m.id = wc.leader_id
      WHERE wc.id = wsf_attendance.centre_id
        AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = wsf_attendance.member_id
        AND m.user_id = auth.uid()
    )
  );
