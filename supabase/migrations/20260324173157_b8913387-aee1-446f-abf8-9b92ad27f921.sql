
-- Phase 7: Tenant-Scoped RLS Policies
-- 1. Create helper function
CREATE OR REPLACE FUNCTION public.user_has_tenant_access(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _tenant_id IS NULL OR EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE user_id = auth.uid() AND tenant_id = _tenant_id
  )
$$;

-- ANNOUNCEMENTS
DROP POLICY IF EXISTS "Admins/leaders can manage announcements" ON public.announcements;
CREATE POLICY "Admins/leaders can manage announcements" ON public.announcements FOR ALL TO authenticated
  USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role) OR has_role(auth.uid(), 'wsf_leader'::app_role)) AND user_has_tenant_access(tenant_id))
  WITH CHECK ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role) OR has_role(auth.uid(), 'wsf_leader'::app_role)) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Authenticated can view published announcements" ON public.announcements;
CREATE POLICY "Authenticated can view published announcements" ON public.announcements FOR SELECT TO authenticated
  USING (((is_published = true) OR is_admin(auth.uid())) AND user_has_tenant_access(tenant_id));

-- APP_SETTINGS
DROP POLICY IF EXISTS "Admins can manage settings" ON public.app_settings;
CREATE POLICY "Admins can manage settings" ON public.app_settings FOR ALL TO authenticated
  USING (is_admin(auth.uid()) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Authenticated can view settings" ON public.app_settings;
CREATE POLICY "Authenticated can view settings" ON public.app_settings FOR SELECT TO authenticated
  USING (user_has_tenant_access(tenant_id));

-- ATTENDANCE_RECORDS
DROP POLICY IF EXISTS "Admins and leaders can view all attendance records" ON public.attendance_records;
CREATE POLICY "Admins and leaders can view all attendance records" ON public.attendance_records FOR SELECT TO authenticated
  USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Admins/leaders can manage records" ON public.attendance_records;
CREATE POLICY "Admins/leaders can manage records" ON public.attendance_records FOR ALL TO authenticated
  USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Members can self check-in" ON public.attendance_records;
CREATE POLICY "Members can self check-in" ON public.attendance_records FOR INSERT TO authenticated
  WITH CHECK ((EXISTS (SELECT 1 FROM members WHERE members.id = attendance_records.member_id AND members.user_id = auth.uid())) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Members can view own attendance records" ON public.attendance_records;
CREATE POLICY "Members can view own attendance records" ON public.attendance_records FOR SELECT TO authenticated
  USING ((EXISTS (SELECT 1 FROM members m WHERE m.id = attendance_records.member_id AND m.user_id = auth.uid())) AND user_has_tenant_access(tenant_id));

-- ATTENDANCE_SESSIONS
DROP POLICY IF EXISTS "Admins/leaders can manage sessions" ON public.attendance_sessions;
CREATE POLICY "Admins/leaders can manage sessions" ON public.attendance_sessions FOR ALL TO authenticated
  USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Authenticated can view sessions" ON public.attendance_sessions;
CREATE POLICY "Authenticated can view sessions" ON public.attendance_sessions FOR SELECT TO authenticated
  USING (user_has_tenant_access(tenant_id));

-- AUDIT_LOG
DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.audit_log;
CREATE POLICY "Admins can insert audit logs" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()) AND auth.uid() = user_id AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Super admins can view audit logs" ON public.audit_log;
CREATE POLICY "Super admins can view audit logs" ON public.audit_log FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) AND user_has_tenant_access(tenant_id));

-- BOOKS_OF_THE_MONTH
DROP POLICY IF EXISTS "Admins can manage books" ON public.books_of_the_month;
CREATE POLICY "Admins can manage books" ON public.books_of_the_month FOR ALL TO authenticated
  USING (is_admin(auth.uid()) AND user_has_tenant_access(tenant_id))
  WITH CHECK (is_admin(auth.uid()) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Authenticated can view books" ON public.books_of_the_month;
CREATE POLICY "Authenticated can view books" ON public.books_of_the_month FOR SELECT TO authenticated
  USING (user_has_tenant_access(tenant_id));

-- CERTIFICATE_TEMPLATES
DROP POLICY IF EXISTS "Admins can manage certificate templates" ON public.certificate_templates;
CREATE POLICY "Admins can manage certificate templates" ON public.certificate_templates FOR ALL TO authenticated
  USING (is_admin(auth.uid()) AND user_has_tenant_access(tenant_id))
  WITH CHECK (is_admin(auth.uid()) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Authenticated can view certificate templates" ON public.certificate_templates;
CREATE POLICY "Authenticated can view certificate templates" ON public.certificate_templates FOR SELECT TO authenticated
  USING (user_has_tenant_access(tenant_id));

-- CHURCH_ATTENDANCE_REPORTS
DROP POLICY IF EXISTS "Authorized users can manage church attendance reports" ON public.church_attendance_reports;
CREATE POLICY "Authorized users can manage church attendance reports" ON public.church_attendance_reports FOR ALL TO authenticated
  USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id))
  WITH CHECK ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Authorized users can view church attendance reports" ON public.church_attendance_reports;
CREATE POLICY "Authorized users can view church attendance reports" ON public.church_attendance_reports FOR SELECT TO authenticated
  USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id));

-- CHURCH_UNITS
DROP POLICY IF EXISTS "Admins can manage church units" ON public.church_units;
CREATE POLICY "Admins can manage church units" ON public.church_units FOR ALL TO authenticated
  USING (is_admin(auth.uid()) AND user_has_tenant_access(tenant_id))
  WITH CHECK (is_admin(auth.uid()) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Authenticated can view church units" ON public.church_units;
CREATE POLICY "Authenticated can view church units" ON public.church_units FOR SELECT TO authenticated
  USING (user_has_tenant_access(tenant_id));

-- COURSE_REGISTRATIONS
DROP POLICY IF EXISTS "Admins can manage registrations" ON public.course_registrations;
CREATE POLICY "Admins can manage registrations" ON public.course_registrations FOR ALL TO authenticated
  USING (is_admin(auth.uid()) AND user_has_tenant_access(tenant_id))
  WITH CHECK (is_admin(auth.uid()) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Members can register for courses" ON public.course_registrations;
CREATE POLICY "Members can register for courses" ON public.course_registrations FOR INSERT TO authenticated
  WITH CHECK ((EXISTS (SELECT 1 FROM members m WHERE m.id = course_registrations.member_id AND m.user_id = auth.uid())) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Members can view own registrations" ON public.course_registrations;
CREATE POLICY "Members can view own registrations" ON public.course_registrations FOR SELECT TO authenticated
  USING ((EXISTS (SELECT 1 FROM members m WHERE m.id = course_registrations.member_id AND m.user_id = auth.uid())) AND user_has_tenant_access(tenant_id));

-- DOCUMENTS
DROP POLICY IF EXISTS "Admins/leaders can manage documents" ON public.documents;
CREATE POLICY "Admins/leaders can manage documents" ON public.documents FOR ALL TO authenticated
  USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id))
  WITH CHECK ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Admins/leaders can view documents" ON public.documents;
CREATE POLICY "Admins/leaders can view documents" ON public.documents FOR SELECT TO authenticated
  USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id));

-- EMAIL_SEND_LOG (admin view only)
DROP POLICY IF EXISTS "Admins can view email logs" ON public.email_send_log;
CREATE POLICY "Admins can view email logs" ON public.email_send_log FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) AND user_has_tenant_access(tenant_id));

-- EVENT_REGISTRATIONS
DROP POLICY IF EXISTS "Admins can manage registrations" ON public.event_registrations;
CREATE POLICY "Admins can manage event registrations" ON public.event_registrations FOR ALL TO authenticated
  USING (is_admin(auth.uid()) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Users can register for events" ON public.event_registrations;
CREATE POLICY "Users can register for events" ON public.event_registrations FOR INSERT TO authenticated
  WITH CHECK (((auth.uid() = user_id) OR is_admin(auth.uid())) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Users can view own registrations" ON public.event_registrations;
CREATE POLICY "Users can view own event registrations" ON public.event_registrations FOR SELECT TO authenticated
  USING (((auth.uid() = user_id) OR (EXISTS (SELECT 1 FROM members m WHERE m.id = event_registrations.member_id AND m.user_id = auth.uid())) OR is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id));

-- EVENTS
DROP POLICY IF EXISTS "Admins/leaders can manage events" ON public.events;
CREATE POLICY "Admins/leaders can manage events" ON public.events FOR ALL TO authenticated
  USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role) OR has_role(auth.uid(), 'wsf_leader'::app_role)) AND user_has_tenant_access(tenant_id))
  WITH CHECK ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role) OR has_role(auth.uid(), 'wsf_leader'::app_role)) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Anyone can view public events" ON public.events;
CREATE POLICY "Anyone can view public events" ON public.events FOR SELECT TO authenticated
  USING (user_has_tenant_access(tenant_id));

-- EXAM_ANSWERS
DROP POLICY IF EXISTS "Admins/leaders can manage exam answers" ON public.exam_answers;
CREATE POLICY "Admins/leaders can manage exam answers" ON public.exam_answers FOR ALL TO authenticated
  USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id))
  WITH CHECK ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Admins/leaders can view all exam answers" ON public.exam_answers;
CREATE POLICY "Admins/leaders can view all exam answers" ON public.exam_answers FOR SELECT TO authenticated
  USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Members can insert own exam answers" ON public.exam_answers;
CREATE POLICY "Members can insert own exam answers" ON public.exam_answers FOR INSERT TO authenticated
  WITH CHECK ((EXISTS (SELECT 1 FROM exam_attempts ea JOIN members m ON m.id = ea.member_id WHERE ea.id = exam_answers.attempt_id AND m.user_id = auth.uid())) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Members can view own exam answers" ON public.exam_answers;
CREATE POLICY "Members can view own exam answers" ON public.exam_answers FOR SELECT TO authenticated
  USING ((EXISTS (SELECT 1 FROM exam_attempts ea JOIN members m ON m.id = ea.member_id WHERE ea.id = exam_answers.attempt_id AND m.user_id = auth.uid())) AND user_has_tenant_access(tenant_id));

-- EXAM_ATTEMPTS
DROP POLICY IF EXISTS "Admins/leaders can manage exam attempts" ON public.exam_attempts;
CREATE POLICY "Admins/leaders can manage exam attempts" ON public.exam_attempts FOR ALL TO authenticated
  USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id))
  WITH CHECK ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Admins/leaders can view all exam attempts" ON public.exam_attempts;
CREATE POLICY "Admins/leaders can view all exam attempts" ON public.exam_attempts FOR SELECT TO authenticated
  USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Members can insert own exam attempts" ON public.exam_attempts;
CREATE POLICY "Members can insert own exam attempts" ON public.exam_attempts FOR INSERT TO authenticated
  WITH CHECK ((EXISTS (SELECT 1 FROM members m WHERE m.id = exam_attempts.member_id AND m.user_id = auth.uid())) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Members can update own exam attempts" ON public.exam_attempts;
CREATE POLICY "Members can update own exam attempts" ON public.exam_attempts FOR UPDATE TO authenticated
  USING ((EXISTS (SELECT 1 FROM members m WHERE m.id = exam_attempts.member_id AND m.user_id = auth.uid())) AND user_has_tenant_access(tenant_id))
  WITH CHECK ((EXISTS (SELECT 1 FROM members m WHERE m.id = exam_attempts.member_id AND m.user_id = auth.uid())) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Members can view own exam attempts" ON public.exam_attempts;
CREATE POLICY "Members can view own exam attempts" ON public.exam_attempts FOR SELECT TO authenticated
  USING ((EXISTS (SELECT 1 FROM members m WHERE m.id = exam_attempts.member_id AND m.user_id = auth.uid())) AND user_has_tenant_access(tenant_id));

-- EXAM_QUESTIONS
DROP POLICY IF EXISTS "Admins/leaders can manage exam questions" ON public.exam_questions;
CREATE POLICY "Admins/leaders can manage exam questions" ON public.exam_questions FOR ALL TO authenticated
  USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id))
  WITH CHECK ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Authenticated can view exam questions" ON public.exam_questions;
CREATE POLICY "Authenticated can view exam questions" ON public.exam_questions FOR SELECT TO authenticated
  USING (user_has_tenant_access(tenant_id));

-- EXAM_SESSION_COURSES
DROP POLICY IF EXISTS "Admins can manage session courses" ON public.exam_session_courses;
CREATE POLICY "Admins can manage session courses" ON public.exam_session_courses FOR ALL TO authenticated
  USING (is_admin(auth.uid()) AND user_has_tenant_access(tenant_id))
  WITH CHECK (is_admin(auth.uid()) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Authenticated can view session courses" ON public.exam_session_courses;
CREATE POLICY "Authenticated can view session courses" ON public.exam_session_courses FOR SELECT TO authenticated
  USING (user_has_tenant_access(tenant_id));

-- EXAM_SESSIONS
DROP POLICY IF EXISTS "Admins can manage exam sessions" ON public.exam_sessions;
CREATE POLICY "Admins can manage exam sessions" ON public.exam_sessions FOR ALL TO authenticated
  USING (is_admin(auth.uid()) AND user_has_tenant_access(tenant_id))
  WITH CHECK (is_admin(auth.uid()) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Authenticated can view exam sessions" ON public.exam_sessions;
CREATE POLICY "Authenticated can view exam sessions" ON public.exam_sessions FOR SELECT TO authenticated
  USING (user_has_tenant_access(tenant_id));

-- EXAM_SUBJECTS
DROP POLICY IF EXISTS "Admins can manage exam subjects" ON public.exam_subjects;
CREATE POLICY "Admins can manage exam subjects" ON public.exam_subjects FOR ALL TO authenticated
  USING (is_admin(auth.uid()) AND user_has_tenant_access(tenant_id))
  WITH CHECK (is_admin(auth.uid()) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Authenticated can view exam subjects" ON public.exam_subjects;
CREATE POLICY "Authenticated can view exam subjects" ON public.exam_subjects FOR SELECT TO authenticated
  USING (user_has_tenant_access(tenant_id));

-- EXAM_TITLES
DROP POLICY IF EXISTS "Admins can manage exam titles" ON public.exam_titles;
CREATE POLICY "Admins can manage exam titles" ON public.exam_titles FOR ALL TO authenticated
  USING (is_admin(auth.uid()) AND user_has_tenant_access(tenant_id))
  WITH CHECK (is_admin(auth.uid()) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Authenticated can view exam titles" ON public.exam_titles;
CREATE POLICY "Authenticated can view exam titles" ON public.exam_titles FOR SELECT TO authenticated
  USING (user_has_tenant_access(tenant_id));

-- FIRST_TIMERS
DROP POLICY IF EXISTS "Admins/leaders can manage first timers" ON public.first_timers;
CREATE POLICY "Admins/leaders can manage first timers" ON public.first_timers FOR ALL TO authenticated
  USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Admins/leaders can view first timers" ON public.first_timers;
CREATE POLICY "Admins/leaders can view first timers" ON public.first_timers FOR SELECT TO authenticated
  USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id));

-- FOLLOWUPS
DROP POLICY IF EXISTS "Admins/leaders can manage followups" ON public.followups;
CREATE POLICY "Admins/leaders can manage followups" ON public.followups FOR ALL TO authenticated
  USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Admins/leaders can view followups" ON public.followups;
CREATE POLICY "Admins/leaders can view followups" ON public.followups FOR SELECT TO authenticated
  USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role) OR auth.uid() = assigned_to) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Assigned users can update followups" ON public.followups;
CREATE POLICY "Assigned users can update followups" ON public.followups FOR UPDATE TO authenticated
  USING (auth.uid() = assigned_to AND user_has_tenant_access(tenant_id))
  WITH CHECK (auth.uid() = assigned_to AND user_has_tenant_access(tenant_id));

-- MEMBER_STATUS_HISTORY
DROP POLICY IF EXISTS "Admins/leaders can view status history" ON public.member_status_history;
CREATE POLICY "Admins/leaders can view status history" ON public.member_status_history FOR SELECT TO authenticated
  USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role) OR has_role(auth.uid(), 'wsf_leader'::app_role)) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Members can view own status history" ON public.member_status_history;
CREATE POLICY "Members can view own status history" ON public.member_status_history FOR SELECT TO authenticated
  USING ((EXISTS (SELECT 1 FROM members m WHERE m.id = member_status_history.member_id AND m.user_id = auth.uid())) AND user_has_tenant_access(tenant_id));

-- MEMBERS
DROP POLICY IF EXISTS "Admins and leaders can update members" ON public.members;
CREATE POLICY "Admins and leaders can update members" ON public.members FOR UPDATE TO authenticated
  USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id))
  WITH CHECK ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Admins and leaders can view all members" ON public.members;
CREATE POLICY "Admins and leaders can view all members" ON public.members FOR SELECT TO authenticated
  USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Admins can delete members" ON public.members;
CREATE POLICY "Admins can delete members" ON public.members FOR DELETE TO authenticated
  USING (is_admin(auth.uid()) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Admins can insert members" ON public.members;
CREATE POLICY "Admins can insert members" ON public.members FOR INSERT TO authenticated
  WITH CHECK ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Members can view own record" ON public.members;
CREATE POLICY "Members can view own record" ON public.members FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "WSF leaders can update members for own centre" ON public.members;
CREATE POLICY "WSF leaders can update members for own centre" ON public.members FOR UPDATE TO authenticated
  USING (is_wsf_leader_for_centre(auth.uid(), wsf_centre_id) AND user_has_tenant_access(tenant_id))
  WITH CHECK (is_wsf_leader_for_centre(auth.uid(), wsf_centre_id) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "WSF leaders can view centre members" ON public.members;
CREATE POLICY "WSF leaders can view centre members" ON public.members FOR SELECT TO authenticated
  USING (is_wsf_leader_for_centre(auth.uid(), wsf_centre_id) AND user_has_tenant_access(tenant_id));

-- MESSAGES
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
CREATE POLICY "Users can view own messages" ON public.messages FOR SELECT TO authenticated
  USING ((auth.uid() = sender_id OR auth.uid() = recipient_id) AND user_has_tenant_access(tenant_id));

-- NOTIFICATIONS
DROP POLICY IF EXISTS "Admins and leaders can insert notifications" ON public.notifications;
CREATE POLICY "Admins and leaders can insert notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND user_has_tenant_access(tenant_id));

-- PASTORAL_CARE
DROP POLICY IF EXISTS "Admins/leaders can manage pastoral care" ON public.pastoral_care;
CREATE POLICY "Admins/leaders can manage pastoral care" ON public.pastoral_care FOR ALL TO authenticated
  USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id))
  WITH CHECK ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Assigned users can update pastoral care" ON public.pastoral_care;
CREATE POLICY "Assigned users can update pastoral care" ON public.pastoral_care FOR UPDATE TO authenticated
  USING (auth.uid() = assigned_to AND user_has_tenant_access(tenant_id))
  WITH CHECK (auth.uid() = assigned_to AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Authorized can view pastoral care" ON public.pastoral_care;
CREATE POLICY "Authorized can view pastoral care" ON public.pastoral_care FOR SELECT TO authenticated
  USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role) OR auth.uid() = assigned_to OR auth.uid() = created_by) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Members can request pastoral care" ON public.pastoral_care;
CREATE POLICY "Members can request pastoral care" ON public.pastoral_care FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND user_has_tenant_access(tenant_id));

-- PICKUP_LOCATIONS
DROP POLICY IF EXISTS "Admins can manage pickup locations" ON public.pickup_locations;
CREATE POLICY "Admins can manage pickup locations" ON public.pickup_locations FOR ALL TO authenticated
  USING (is_admin(auth.uid()) AND user_has_tenant_access(tenant_id))
  WITH CHECK (is_admin(auth.uid()) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Authenticated can view pickup locations" ON public.pickup_locations;
CREATE POLICY "Authenticated can view pickup locations" ON public.pickup_locations FOR SELECT TO authenticated
  USING (user_has_tenant_access(tenant_id));

-- PROFILES
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated
  USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- SMS_LOG
DROP POLICY IF EXISTS "Admins/leaders can insert sms logs" ON public.sms_log;
CREATE POLICY "Admins/leaders can insert sms logs" ON public.sms_log FOR INSERT TO authenticated
  WITH CHECK ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role) OR has_role(auth.uid(), 'wsf_leader'::app_role)) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Admins/leaders can view sms logs" ON public.sms_log;
CREATE POLICY "Admins/leaders can view sms logs" ON public.sms_log FOR SELECT TO authenticated
  USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role) OR has_role(auth.uid(), 'wsf_leader'::app_role)) AND user_has_tenant_access(tenant_id));

-- TRANSPORTATION
DROP POLICY IF EXISTS "Admins/leaders can manage transport" ON public.transportation;
CREATE POLICY "Admins/leaders can manage transport" ON public.transportation FOR ALL TO authenticated
  USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id))
  WITH CHECK ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Users can request transport" ON public.transportation;
CREATE POLICY "Users can request transport" ON public.transportation FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Users can view own transport" ON public.transportation;
CREATE POLICY "Users can view own transport" ON public.transportation FOR SELECT TO authenticated
  USING ((auth.uid() = user_id OR is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id));

-- UNIT_LEADER_ASSIGNMENTS
DROP POLICY IF EXISTS "Admins can manage unit leader assignments" ON public.unit_leader_assignments;
CREATE POLICY "Admins can manage unit leader assignments" ON public.unit_leader_assignments FOR ALL TO authenticated
  USING (is_admin(auth.uid()) AND user_has_tenant_access(tenant_id))
  WITH CHECK (is_admin(auth.uid()) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Users can view own assignments" ON public.unit_leader_assignments;
CREATE POLICY "Users can view own assignments" ON public.unit_leader_assignments FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND user_has_tenant_access(tenant_id));

-- USER_ROLES
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Super admins can manage roles" ON public.user_roles;
CREATE POLICY "Super admins can manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) AND user_has_tenant_access(tenant_id))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- WSF_ATTENDANCE
DROP POLICY IF EXISTS "Admins/leaders can manage wsf attendance" ON public.wsf_attendance;
CREATE POLICY "Admins/leaders can manage wsf attendance" ON public.wsf_attendance FOR ALL TO authenticated
  USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Admins/leaders can view wsf attendance" ON public.wsf_attendance;
CREATE POLICY "Admins/leaders can view wsf attendance" ON public.wsf_attendance FOR SELECT TO authenticated
  USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role) OR has_role(auth.uid(), 'wsf_leader'::app_role) OR is_wsf_leader_for_centre(auth.uid(), centre_id) OR EXISTS (SELECT 1 FROM members m WHERE m.id = wsf_attendance.member_id AND m.user_id = auth.uid())) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "WSF leaders can manage own centre attendance" ON public.wsf_attendance;
CREATE POLICY "WSF leaders can manage own centre attendance" ON public.wsf_attendance FOR ALL TO authenticated
  USING (is_wsf_leader_for_centre(auth.uid(), centre_id) AND user_has_tenant_access(tenant_id))
  WITH CHECK (is_wsf_leader_for_centre(auth.uid(), centre_id) AND user_has_tenant_access(tenant_id));

-- WSF_CENTRES
DROP POLICY IF EXISTS "Admins can manage centres" ON public.wsf_centres;
CREATE POLICY "Admins can manage centres" ON public.wsf_centres FOR ALL TO authenticated
  USING (is_admin(auth.uid()) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Authenticated can view centres" ON public.wsf_centres;
CREATE POLICY "Authenticated can view centres" ON public.wsf_centres FOR SELECT TO authenticated
  USING (user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "WSF leaders can update own centre" ON public.wsf_centres;
CREATE POLICY "WSF leaders can update own centre" ON public.wsf_centres FOR UPDATE TO authenticated
  USING (is_wsf_leader_for_centre(auth.uid(), id) AND user_has_tenant_access(tenant_id))
  WITH CHECK (is_wsf_leader_for_centre(auth.uid(), id) AND user_has_tenant_access(tenant_id));

-- WSF_ZONES
DROP POLICY IF EXISTS "Admins can manage wsf zones" ON public.wsf_zones;
CREATE POLICY "Admins can manage wsf zones" ON public.wsf_zones FOR ALL TO authenticated
  USING (is_admin(auth.uid()) AND user_has_tenant_access(tenant_id))
  WITH CHECK (is_admin(auth.uid()) AND user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Authenticated can view wsf zones" ON public.wsf_zones;
CREATE POLICY "Authenticated can view wsf zones" ON public.wsf_zones FOR SELECT TO authenticated
  USING (user_has_tenant_access(tenant_id));
