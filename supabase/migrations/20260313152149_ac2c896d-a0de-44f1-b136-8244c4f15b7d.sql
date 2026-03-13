-- Allow anonymous inserts to members table for public registration
CREATE POLICY "Public can register as member"
ON public.members
FOR INSERT
TO anon
WITH CHECK (
  membership_status IN ('First Timer', 'New Convert')
  AND gdpr_consent = true
);

-- Allow anonymous inserts to followups for auto-created followups from registration
CREATE POLICY "Public registration can create followup"
ON public.followups
FOR INSERT
TO anon
WITH CHECK (
  followup_type IN ('First Timer', 'New Convert')
  AND status = 'Pending'
);