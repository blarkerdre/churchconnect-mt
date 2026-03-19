-- Restrict audit_log INSERT to admins only
DROP POLICY "Authenticated can insert audit logs" ON audit_log;

CREATE POLICY "Admins can insert audit logs"
  ON audit_log FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()) AND auth.uid() = user_id);