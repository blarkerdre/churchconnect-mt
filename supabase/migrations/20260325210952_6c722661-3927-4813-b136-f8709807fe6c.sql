-- Remove all data for the extra test tenant before deleting it
DO $$
DECLARE
  tid uuid := 'd6f3b537-20d6-4a50-b5b8-83074eccddaf';
BEGIN
  DELETE FROM exam_answers WHERE tenant_id = tid;
  DELETE FROM exam_attempts WHERE tenant_id = tid;
  DELETE FROM exam_questions WHERE tenant_id = tid;
  DELETE FROM exam_session_courses WHERE tenant_id = tid;
  DELETE FROM exam_subjects WHERE tenant_id = tid;
  DELETE FROM exam_titles WHERE tenant_id = tid;
  DELETE FROM exam_sessions WHERE tenant_id = tid;
  DELETE FROM course_registrations WHERE tenant_id = tid;
  DELETE FROM attendance_records WHERE tenant_id = tid;
  DELETE FROM attendance_sessions WHERE tenant_id = tid;
  DELETE FROM event_registrations WHERE tenant_id = tid;
  DELETE FROM events WHERE tenant_id = tid;
  DELETE FROM followups WHERE tenant_id = tid;
  DELETE FROM first_timers WHERE tenant_id = tid;
  DELETE FROM pastoral_care WHERE tenant_id = tid;
  DELETE FROM member_status_history WHERE tenant_id = tid;
  DELETE FROM members WHERE tenant_id = tid;
  DELETE FROM messages WHERE tenant_id = tid;
  DELETE FROM notifications WHERE tenant_id = tid;
  DELETE FROM announcements WHERE tenant_id = tid;
  DELETE FROM app_settings WHERE tenant_id = tid;
  DELETE FROM audit_log WHERE tenant_id = tid;
  DELETE FROM books_of_the_month WHERE tenant_id = tid;
  DELETE FROM certificate_templates WHERE tenant_id = tid;
  DELETE FROM church_attendance_reports WHERE tenant_id = tid;
  DELETE FROM church_units WHERE tenant_id = tid;
  DELETE FROM documents WHERE tenant_id = tid;
  DELETE FROM email_send_log WHERE tenant_id = tid;
  DELETE FROM pickup_locations WHERE tenant_id = tid;
  DELETE FROM profiles WHERE tenant_id = tid;
  DELETE FROM purged_data_archives WHERE tenant_id = tid;
  DELETE FROM sms_log WHERE tenant_id = tid;
  DELETE FROM training_completions WHERE tenant_id = tid;
  DELETE FROM training_reports WHERE tenant_id = tid;
  DELETE FROM transportation WHERE tenant_id = tid;
  DELETE FROM unit_leader_assignments WHERE tenant_id = tid;
  DELETE FROM wsf_attendance WHERE tenant_id = tid;
  DELETE FROM wsf_attendance_reports WHERE tenant_id = tid;
  DELETE FROM wsf_centres WHERE tenant_id = tid;
  DELETE FROM wsf_zones WHERE tenant_id = tid;
  DELETE FROM tenant_invitations WHERE tenant_id = tid;
  DELETE FROM tenant_memberships WHERE tenant_id = tid;
  DELETE FROM tenants WHERE id = tid;
END $$;