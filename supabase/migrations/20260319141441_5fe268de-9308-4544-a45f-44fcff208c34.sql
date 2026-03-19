-- Security definer function to check if user is a WSF leader for a given centre
CREATE OR REPLACE FUNCTION public.is_wsf_leader_for_centre(_user_id uuid, _centre_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.wsf_centres wc
    JOIN public.members m ON m.id = wc.leader_id
    WHERE wc.id = _centre_id
      AND m.user_id = _user_id
  )
$$;

-- Drop the recursive policies on members
DROP POLICY IF EXISTS "WSF leaders can update members for own centre" ON public.members;
DROP POLICY IF EXISTS "WSF leaders can view centre members" ON public.members;

-- Recreate using the security definer function
CREATE POLICY "WSF leaders can view centre members"
ON public.members FOR SELECT
TO authenticated
USING (public.is_wsf_leader_for_centre(auth.uid(), wsf_centre_id));

CREATE POLICY "WSF leaders can update members for own centre"
ON public.members FOR UPDATE
TO authenticated
USING (public.is_wsf_leader_for_centre(auth.uid(), wsf_centre_id))
WITH CHECK (public.is_wsf_leader_for_centre(auth.uid(), wsf_centre_id));

-- Also fix the recursive policies on wsf_centres that reference members
DROP POLICY IF EXISTS "WSF leaders can update own centre" ON public.wsf_centres;

CREATE POLICY "WSF leaders can update own centre"
ON public.wsf_centres FOR UPDATE
TO authenticated
USING (public.is_wsf_leader_for_centre(auth.uid(), id))
WITH CHECK (public.is_wsf_leader_for_centre(auth.uid(), id));

-- Fix recursive policies on wsf_attendance that reference members
DROP POLICY IF EXISTS "WSF leaders can manage own centre attendance" ON public.wsf_attendance;
DROP POLICY IF EXISTS "Admins/leaders can view wsf attendance" ON public.wsf_attendance;

CREATE POLICY "WSF leaders can manage own centre attendance"
ON public.wsf_attendance FOR ALL
TO authenticated
USING (public.is_wsf_leader_for_centre(auth.uid(), centre_id))
WITH CHECK (public.is_wsf_leader_for_centre(auth.uid(), centre_id));

CREATE POLICY "Admins/leaders can view wsf attendance"
ON public.wsf_attendance FOR SELECT
TO authenticated
USING (
  is_admin(auth.uid())
  OR has_role(auth.uid(), 'unit_leader'::app_role)
  OR has_role(auth.uid(), 'wsf_leader'::app_role)
  OR public.is_wsf_leader_for_centre(auth.uid(), centre_id)
  OR EXISTS (SELECT 1 FROM public.members m WHERE m.id = wsf_attendance.member_id AND m.user_id = auth.uid())
);

-- Fix recursive policies on wsf_attendance_reports
DROP POLICY IF EXISTS "WSF leaders can manage own centre reports" ON public.wsf_attendance_reports;

CREATE POLICY "WSF leaders can manage own centre reports"
ON public.wsf_attendance_reports FOR ALL
TO authenticated
USING (public.is_wsf_leader_for_centre(auth.uid(), centre_id))
WITH CHECK (public.is_wsf_leader_for_centre(auth.uid(), centre_id));