
-- Step 1: Create tenant-aware function overloads

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role AND tenant_id = _tenant_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'super_admin')
      AND (tenant_id = _tenant_id OR role = 'super_admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE user_id = _user_id AND tenant_id = _tenant_id
      AND role IN ('owner', 'admin')
  )
$$;

-- Step 2: Update all RLS policies

-- ===== announcements =====
DROP POLICY IF EXISTS "Admins/leaders can manage announcements" ON public.announcements;
CREATE POLICY "Admins/leaders can manage announcements" ON public.announcements FOR ALL TO authenticated
  USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id) OR has_role(auth.uid(), 'wsf_leader'::app_role, tenant_id))
  WITH CHECK (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id) OR has_role(auth.uid(), 'wsf_leader'::app_role, tenant_id));

DROP POLICY IF EXISTS "Authenticated can view published announcements" ON public.announcements;
CREATE POLICY "Authenticated can view published announcements" ON public.announcements FOR SELECT TO authenticated
  USING ((is_published = true OR is_admin(auth.uid(), tenant_id)) AND user_has_tenant_access(tenant_id));

-- ===== app_settings =====
DROP POLICY IF EXISTS "Admins can manage settings" ON public.app_settings;
CREATE POLICY "Admins can manage settings" ON public.app_settings FOR ALL TO authenticated
  USING (is_admin(auth.uid(), tenant_id))
  WITH CHECK (is_admin(auth.uid(), tenant_id));

-- ===== attendance_records =====
DROP POLICY IF EXISTS "Admins and leaders can view all attendance records" ON public.attendance_records;
CREATE POLICY "Admins and leaders can view all attendance records" ON public.attendance_records FOR SELECT TO authenticated
  USING ((is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id)) AND user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Admins/leaders can manage records" ON public.attendance_records;
CREATE POLICY "Admins/leaders can manage records" ON public.attendance_records FOR ALL TO authenticated
  USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id))
  WITH CHECK (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id));

-- ===== attendance_sessions =====
DROP POLICY IF EXISTS "Admins/leaders can manage sessions" ON public.attendance_sessions;
CREATE POLICY "Admins/leaders can manage sessions" ON public.attendance_sessions FOR ALL TO authenticated
  USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id))
  WITH CHECK (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id));

-- ===== audit_log =====
DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.audit_log;
CREATE POLICY "Admins can insert audit logs" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid(), tenant_id) AND (auth.uid() = user_id));

-- super_admin stays global for audit viewing
DROP POLICY IF EXISTS "Super admins can view audit logs" ON public.audit_log;
CREATE POLICY "Super admins can view audit logs" ON public.audit_log FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR (is_admin(auth.uid(), tenant_id) AND user_has_tenant_access(tenant_id)));

-- ===== books_of_the_month =====
DROP POLICY IF EXISTS "Admins can manage books" ON public.books_of_the_month;
CREATE POLICY "Admins can manage books" ON public.books_of_the_month FOR ALL TO authenticated
  USING (is_admin(auth.uid(), tenant_id))
  WITH CHECK (is_admin(auth.uid(), tenant_id));

-- ===== certificate_templates =====
DROP POLICY IF EXISTS "Admins can manage certificate templates" ON public.certificate_templates;
CREATE POLICY "Admins can manage certificate templates" ON public.certificate_templates FOR ALL TO authenticated
  USING (is_admin(auth.uid(), tenant_id))
  WITH CHECK (is_admin(auth.uid(), tenant_id));

-- ===== church_attendance_reports =====
DROP POLICY IF EXISTS "Authorized users can manage church attendance reports" ON public.church_attendance_reports;
CREATE POLICY "Authorized users can manage church attendance reports" ON public.church_attendance_reports FOR ALL TO authenticated
  USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id))
  WITH CHECK (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id));

DROP POLICY IF EXISTS "Authorized users can view church attendance reports" ON public.church_attendance_reports;
CREATE POLICY "Authorized users can view church attendance reports" ON public.church_attendance_reports FOR SELECT TO authenticated
  USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id));

-- ===== church_units =====
DROP POLICY IF EXISTS "Admins can manage church units" ON public.church_units;
CREATE POLICY "Admins can manage church units" ON public.church_units FOR ALL TO authenticated
  USING (is_admin(auth.uid(), tenant_id))
  WITH CHECK (is_admin(auth.uid(), tenant_id));

-- ===== course_registrations =====
DROP POLICY IF EXISTS "Admins can manage registrations" ON public.course_registrations;
CREATE POLICY "Admins can manage registrations" ON public.course_registrations FOR ALL TO authenticated
  USING (is_admin(auth.uid(), tenant_id))
  WITH CHECK (is_admin(auth.uid(), tenant_id));

-- ===== documents =====
DROP POLICY IF EXISTS "Admins/leaders can manage documents" ON public.documents;
CREATE POLICY "Admins/leaders can manage documents" ON public.documents FOR ALL TO authenticated
  USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id))
  WITH CHECK (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id));

DROP POLICY IF EXISTS "Admins/leaders can view documents" ON public.documents;
CREATE POLICY "Admins/leaders can view documents" ON public.documents FOR SELECT TO authenticated
  USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id));

-- ===== email_send_log =====
DROP POLICY IF EXISTS "Admins can view email logs" ON public.email_send_log;
CREATE POLICY "Admins can view email logs" ON public.email_send_log FOR SELECT TO authenticated
  USING (is_admin(auth.uid(), tenant_id));

-- ===== event_registrations =====
DROP POLICY IF EXISTS "Admins can manage event registrations" ON public.event_registrations;
CREATE POLICY "Admins can manage event registrations" ON public.event_registrations FOR ALL TO authenticated
  USING (is_admin(auth.uid(), tenant_id))
  WITH CHECK (is_admin(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Users can register for events" ON public.event_registrations;
CREATE POLICY "Users can register for events" ON public.event_registrations FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id OR is_admin(auth.uid(), tenant_id)) AND user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can view own event registrations" ON public.event_registrations;
CREATE POLICY "Users can view own event registrations" ON public.event_registrations FOR SELECT TO authenticated
  USING ((auth.uid() = user_id OR EXISTS (SELECT 1 FROM members m WHERE m.id = event_registrations.member_id AND m.user_id = auth.uid()) OR is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id)) AND user_has_tenant_access(tenant_id));

-- ===== events =====
DROP POLICY IF EXISTS "Admins/leaders can manage events" ON public.events;
CREATE POLICY "Admins/leaders can manage events" ON public.events FOR ALL TO authenticated
  USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id) OR has_role(auth.uid(), 'wsf_leader'::app_role, tenant_id))
  WITH CHECK (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id) OR has_role(auth.uid(), 'wsf_leader'::app_role, tenant_id));

-- ===== exam_answers =====
DROP POLICY IF EXISTS "Admins/leaders can manage exam answers" ON public.exam_answers;
CREATE POLICY "Admins/leaders can manage exam answers" ON public.exam_answers FOR ALL TO authenticated
  USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id))
  WITH CHECK (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id));

DROP POLICY IF EXISTS "Admins/leaders can view all exam answers" ON public.exam_answers;
CREATE POLICY "Admins/leaders can view all exam answers" ON public.exam_answers FOR SELECT TO authenticated
  USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id));

-- ===== exam_attempts =====
DROP POLICY IF EXISTS "Admins/leaders can manage exam attempts" ON public.exam_attempts;
CREATE POLICY "Admins/leaders can manage exam attempts" ON public.exam_attempts FOR ALL TO authenticated
  USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id))
  WITH CHECK (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id));

DROP POLICY IF EXISTS "Admins/leaders can view all exam attempts" ON public.exam_attempts;
CREATE POLICY "Admins/leaders can view all exam attempts" ON public.exam_attempts FOR SELECT TO authenticated
  USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id));

-- ===== exam_questions =====
DROP POLICY IF EXISTS "Admins/leaders can manage exam questions" ON public.exam_questions;
CREATE POLICY "Admins/leaders can manage exam questions" ON public.exam_questions FOR ALL TO authenticated
  USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id))
  WITH CHECK (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id));

-- ===== exam_session_courses =====
DROP POLICY IF EXISTS "Admins can manage session courses" ON public.exam_session_courses;
CREATE POLICY "Admins can manage session courses" ON public.exam_session_courses FOR ALL TO authenticated
  USING (is_admin(auth.uid(), tenant_id))
  WITH CHECK (is_admin(auth.uid(), tenant_id));

-- ===== exam_sessions =====
DROP POLICY IF EXISTS "Admins can manage exam sessions" ON public.exam_sessions;
CREATE POLICY "Admins can manage exam sessions" ON public.exam_sessions FOR ALL TO authenticated
  USING (is_admin(auth.uid(), tenant_id))
  WITH CHECK (is_admin(auth.uid(), tenant_id));

-- ===== exam_titles =====
DROP POLICY IF EXISTS "Admins can manage exam titles" ON public.exam_titles;
CREATE POLICY "Admins can manage exam titles" ON public.exam_titles FOR ALL TO authenticated
  USING (is_admin(auth.uid(), tenant_id))
  WITH CHECK (is_admin(auth.uid(), tenant_id));

-- ===== first_timers =====
DROP POLICY IF EXISTS "Admins/leaders can manage first timers" ON public.first_timers;
CREATE POLICY "Admins/leaders can manage first timers" ON public.first_timers FOR ALL TO authenticated
  USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id))
  WITH CHECK (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id));

DROP POLICY IF EXISTS "Admins/leaders can view first timers" ON public.first_timers;
CREATE POLICY "Admins/leaders can view first timers" ON public.first_timers FOR SELECT TO authenticated
  USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id));

-- ===== followups =====
DROP POLICY IF EXISTS "Admins/leaders can manage followups" ON public.followups;
CREATE POLICY "Admins/leaders can manage followups" ON public.followups FOR ALL TO authenticated
  USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id))
  WITH CHECK (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id));

DROP POLICY IF EXISTS "Admins/leaders can view followups" ON public.followups;
CREATE POLICY "Admins/leaders can view followups" ON public.followups FOR SELECT TO authenticated
  USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id) OR (auth.uid() = assigned_to AND user_has_tenant_access(tenant_id)));

-- ===== members =====
DROP POLICY IF EXISTS "Admins and leaders can update members" ON public.members;
CREATE POLICY "Admins and leaders can update members" ON public.members FOR UPDATE TO authenticated
  USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id))
  WITH CHECK (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id));

DROP POLICY IF EXISTS "Admins and leaders can view all members" ON public.members;
CREATE POLICY "Admins and leaders can view all members" ON public.members FOR SELECT TO authenticated
  USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id));

DROP POLICY IF EXISTS "Admins can delete members" ON public.members;
CREATE POLICY "Admins can delete members" ON public.members FOR DELETE TO authenticated
  USING (is_admin(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Admins can insert members" ON public.members;
CREATE POLICY "Admins can insert members" ON public.members FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id));

-- ===== member_status_history =====
DROP POLICY IF EXISTS "Admins/leaders can view status history" ON public.member_status_history;
CREATE POLICY "Admins/leaders can view status history" ON public.member_status_history FOR SELECT TO authenticated
  USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id) OR has_role(auth.uid(), 'wsf_leader'::app_role, tenant_id));

-- ===== notifications =====
DROP POLICY IF EXISTS "Admins and leaders can insert notifications" ON public.notifications;
CREATE POLICY "Admins and leaders can insert notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id));

-- ===== pastoral_care =====
DROP POLICY IF EXISTS "Admins/leaders can manage pastoral care" ON public.pastoral_care;
CREATE POLICY "Admins/leaders can manage pastoral care" ON public.pastoral_care FOR ALL TO authenticated
  USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id))
  WITH CHECK (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id));

DROP POLICY IF EXISTS "Authorized can view pastoral care" ON public.pastoral_care;
CREATE POLICY "Authorized can view pastoral care" ON public.pastoral_care FOR SELECT TO authenticated
  USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id) OR (auth.uid() = assigned_to AND user_has_tenant_access(tenant_id)) OR (auth.uid() = created_by AND user_has_tenant_access(tenant_id)));

-- ===== pickup_locations =====
DROP POLICY IF EXISTS "Admins can manage pickup locations" ON public.pickup_locations;
CREATE POLICY "Admins can manage pickup locations" ON public.pickup_locations FOR ALL TO authenticated
  USING (is_admin(auth.uid(), tenant_id))
  WITH CHECK (is_admin(auth.uid(), tenant_id));

-- ===== sms_log =====
DROP POLICY IF EXISTS "Admins/leaders can insert sms logs" ON public.sms_log;
CREATE POLICY "Admins/leaders can insert sms logs" ON public.sms_log FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id) OR has_role(auth.uid(), 'wsf_leader'::app_role, tenant_id));

DROP POLICY IF EXISTS "Admins/leaders can view sms logs" ON public.sms_log;
CREATE POLICY "Admins/leaders can view sms logs" ON public.sms_log FOR SELECT TO authenticated
  USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id) OR has_role(auth.uid(), 'wsf_leader'::app_role, tenant_id));

-- ===== training_completions (also adding missing tenant check) =====
DROP POLICY IF EXISTS "Admins/leaders can manage training completions" ON public.training_completions;
CREATE POLICY "Admins/leaders can manage training completions" ON public.training_completions FOR ALL TO authenticated
  USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id))
  WITH CHECK (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id));

-- ===== training_reports (also adding missing tenant check) =====
DROP POLICY IF EXISTS "Authorized users can manage training reports" ON public.training_reports;
CREATE POLICY "Authorized users can manage training reports" ON public.training_reports FOR ALL TO authenticated
  USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id))
  WITH CHECK (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id));

DROP POLICY IF EXISTS "Authorized users can view training reports" ON public.training_reports;
CREATE POLICY "Authorized users can view training reports" ON public.training_reports FOR SELECT TO authenticated
  USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id));

-- ===== transportation =====
DROP POLICY IF EXISTS "Admins/leaders can manage transport" ON public.transportation;
CREATE POLICY "Admins/leaders can manage transport" ON public.transportation FOR ALL TO authenticated
  USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id))
  WITH CHECK (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id));

DROP POLICY IF EXISTS "Users can view own transport" ON public.transportation;
CREATE POLICY "Users can view own transport" ON public.transportation FOR SELECT TO authenticated
  USING ((auth.uid() = user_id OR is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id)) AND user_has_tenant_access(tenant_id));

-- ===== unit_leader_assignments =====
DROP POLICY IF EXISTS "Admins can manage unit leader assignments" ON public.unit_leader_assignments;
CREATE POLICY "Admins can manage unit leader assignments" ON public.unit_leader_assignments FOR ALL TO authenticated
  USING (is_admin(auth.uid(), tenant_id))
  WITH CHECK (is_admin(auth.uid(), tenant_id));

-- ===== wsf_attendance =====
DROP POLICY IF EXISTS "Admins/leaders can manage wsf attendance" ON public.wsf_attendance;
CREATE POLICY "Admins/leaders can manage wsf attendance" ON public.wsf_attendance FOR ALL TO authenticated
  USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id))
  WITH CHECK (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id));

DROP POLICY IF EXISTS "Admins/leaders can view wsf attendance" ON public.wsf_attendance;
CREATE POLICY "Admins/leaders can view wsf attendance" ON public.wsf_attendance FOR SELECT TO authenticated
  USING ((is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id) OR has_role(auth.uid(), 'wsf_leader'::app_role, tenant_id) OR is_wsf_leader_for_centre(auth.uid(), centre_id) OR EXISTS (SELECT 1 FROM members m WHERE m.id = wsf_attendance.member_id AND m.user_id = auth.uid())) AND user_has_tenant_access(tenant_id));

-- ===== wsf_attendance_reports (also adding missing tenant check) =====
DROP POLICY IF EXISTS "Admins/leaders can manage wsf reports" ON public.wsf_attendance_reports;
CREATE POLICY "Admins/leaders can manage wsf reports" ON public.wsf_attendance_reports FOR ALL TO authenticated
  USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id))
  WITH CHECK (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id));

DROP POLICY IF EXISTS "WSF leaders can manage own centre reports" ON public.wsf_attendance_reports;
CREATE POLICY "WSF leaders can manage own centre reports" ON public.wsf_attendance_reports FOR ALL TO authenticated
  USING (is_wsf_leader_for_centre(auth.uid(), centre_id) AND user_has_tenant_access(tenant_id))
  WITH CHECK (is_wsf_leader_for_centre(auth.uid(), centre_id) AND user_has_tenant_access(tenant_id));

-- ===== wsf_centres =====
DROP POLICY IF EXISTS "Admins can manage centres" ON public.wsf_centres;
CREATE POLICY "Admins can manage centres" ON public.wsf_centres FOR ALL TO authenticated
  USING (is_admin(auth.uid(), tenant_id))
  WITH CHECK (is_admin(auth.uid(), tenant_id));

-- ===== profiles =====
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id));
-- Super admins policy stays global (already uses has_role(auth.uid(), 'super_admin'))
