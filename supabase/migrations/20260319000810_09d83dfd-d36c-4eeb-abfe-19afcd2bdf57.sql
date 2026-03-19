
-- 1. Fix profiles SELECT: restrict to own profile + admins/leaders
DROP POLICY "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role));

-- 2. Fix attendance_records SELECT: restrict to own records + admins/leaders
DROP POLICY "Authenticated can view records" ON public.attendance_records;

CREATE POLICY "Members can view own attendance records" ON public.attendance_records
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = attendance_records.member_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and leaders can view all attendance records" ON public.attendance_records
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role));
