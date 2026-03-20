CREATE POLICY "Admins can view email logs"
ON public.email_send_log FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));