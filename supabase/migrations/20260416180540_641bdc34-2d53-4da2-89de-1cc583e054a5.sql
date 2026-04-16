-- Add acknowledgment columns to app_feedback
ALTER TABLE public.app_feedback
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS acknowledged_by uuid,
  ADD COLUMN IF NOT EXISTS admin_response text;

-- Allow tenant admins to update acknowledgment fields on feedback in their tenant
CREATE POLICY "Admins can acknowledge feedback"
ON public.app_feedback
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid(), tenant_id))
WITH CHECK (is_admin(auth.uid(), tenant_id));