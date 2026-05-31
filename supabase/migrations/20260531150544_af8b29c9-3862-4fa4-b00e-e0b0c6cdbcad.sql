
-- Helper: is the user a reports_officer for this tenant?
CREATE OR REPLACE FUNCTION public.is_reports_officer(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'reports_officer'::app_role
      AND (tenant_id = _tenant_id OR tenant_id IS NULL)
  );
$$;

-- Add additive SELECT-only policies for reports_officer on reporting tables.
-- These are permissive (OR'd with existing policies) so they only widen read access.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'members','member_status_history',
    'attendance_sessions','attendance_records',
    'church_attendance_reports',
    'followups','followup_referrals','followup_referral_updates',
    'events','event_registrations','event_reactions',
    'announcements','announcement_reactions','sms_log','email_send_log','call_log',
    'pastoral_care',
    'transportation',
    'unit_tasks','unit_task_assignments','unit_task_comments',
    'wsf_centres','wsf_attendance','wsf_attendance_reports','wsf_zones',
    'exam_sessions','exam_session_courses','exam_attempts','exam_answers',
    'exam_subjects','exam_titles','exam_questions','exam_question_answers',
    'course_registrations',
    'training_reports','training_completions',
    'first_timers','messages','unit_join_requests',
    'church_units','unit_leader_assignments'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "Reports officers can view all" ON public.%I', t
    );
    EXECUTE format(
      'CREATE POLICY "Reports officers can view all" ON public.%I FOR SELECT TO authenticated USING (public.is_reports_officer(auth.uid(), tenant_id))',
      t
    );
  END LOOP;
END $$;
