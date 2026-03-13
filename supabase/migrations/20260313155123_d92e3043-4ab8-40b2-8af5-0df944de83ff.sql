
-- Drop the old restrictive policy and replace with one allowing all membership statuses
DROP POLICY IF EXISTS "Public can register as member" ON public.members;
CREATE POLICY "Public can register as member" ON public.members
  FOR INSERT TO anon
  WITH CHECK (gdpr_consent = true);
