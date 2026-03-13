
-- Allow unit_leader to manage announcements
DROP POLICY IF EXISTS "Admins can manage announcements" ON public.announcements;
CREATE POLICY "Admins/leaders can manage announcements" ON public.announcements
FOR ALL TO authenticated
USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role))
WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role));

-- Allow any authenticated user to INSERT pastoral care (member requesting care)
DROP POLICY IF EXISTS "Admins can manage pastoral care" ON public.pastoral_care;
CREATE POLICY "Admins/leaders can manage pastoral care" ON public.pastoral_care
FOR ALL TO authenticated
USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role))
WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role));

CREATE POLICY "Members can request pastoral care" ON public.pastoral_care
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Update pastoral care view policy to let members see their own requests
DROP POLICY IF EXISTS "Authorized can view pastoral care" ON public.pastoral_care;
CREATE POLICY "Authorized can view pastoral care" ON public.pastoral_care
FOR SELECT TO authenticated
USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role) OR auth.uid() = assigned_to OR auth.uid() = created_by);

-- Allow unit_leader to manage transportation
DROP POLICY IF EXISTS "Admins can manage transport" ON public.transportation;
CREATE POLICY "Admins/leaders can manage transport" ON public.transportation
FOR ALL TO authenticated
USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role))
WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role));

-- Allow members to view their own transport requests
DROP POLICY IF EXISTS "Users can view own transport" ON public.transportation;
CREATE POLICY "Users can view own transport" ON public.transportation
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role));
