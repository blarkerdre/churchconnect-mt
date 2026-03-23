

## Purge All Data — Super Admin Only

### Summary
Add a "Danger Zone" tab in Settings (visible only to Super Admins) with a "Delete All Data" action. This purges all transactional/record data from the database while preserving app configuration (app_settings, church_units, certificate_templates, etc.). The action requires a multi-step confirmation with password re-authentication.

### User Flow
1. Super Admin navigates to Settings → "Danger Zone" tab
2. Clicks "Delete All Data"
3. First dialog: strong warning explaining what will be deleted and what will be preserved
4. Must type "DELETE ALL DATA" to confirm
5. Must enter their account password for re-authentication
6. Edge function executes the purge server-side using service role

### What Gets Deleted
- members, profiles, user_roles (except the acting super admin)
- attendance_sessions, attendance_records
- followups, pastoral_care, events, event_registrations
- announcements, messages, notifications
- documents, sms_log, email_send_log
- exam_attempts, exam_answers, course_registrations
- first_timers, member_status_history
- transport bookings, wsf_attendance, audit_log
- Storage bucket files (church-documents)

### What Gets Preserved
- app_settings, church_units, certificate_templates
- exam_questions, exam_subjects, exam_titles, exam_sessions, exam_session_courses
- pickup_locations, wsf_centres
- email_send_state, email_unsubscribe_tokens
- The acting Super Admin's own user account, profile, and role

### Changes

**1. New Edge Function: `supabase/functions/purge-all-data/index.ts`**
- Accepts POST with user's password
- Verifies JWT, checks super_admin role via `has_role()`
- Re-authenticates user with provided password via `signInWithPassword`
- Deletes data from all transactional tables in correct order (respecting FK constraints)
- Preserves the acting user's profile and role
- Clears storage bucket files
- Returns success/failure

**2. `src/pages/Settings.jsx`**
- Add a "Danger Zone" tab (with `AlertTriangle` icon), visible only to Super Admins
- New `DangerZoneSection` component with:
  - Red-bordered card with clear warnings about irreversibility
  - "Delete All Data" button (destructive variant)
  - Multi-step AlertDialog:
    - Step 1: Warning text, must type "DELETE ALL DATA" in an input to proceed
    - Step 2: Password input for re-authentication
  - Calls the edge function, shows loading state, toast on success/error

### Technical Detail
- Edge function uses service role client to bypass RLS for deletions
- Password re-auth ensures the person clicking is the actual account holder
- Confirmation phrase prevents accidental clicks
- Delete order respects foreign key constraints (child tables first)
- The acting super admin's records are excluded via `WHERE user_id != acting_user_id`

