
-- Fix the overly permissive INSERT policy
DROP POLICY "Authenticated can insert notifications" ON public.notifications;

-- Only admins/leaders or system (via SECURITY DEFINER functions) can insert
CREATE POLICY "Admins and leaders can insert notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role));
