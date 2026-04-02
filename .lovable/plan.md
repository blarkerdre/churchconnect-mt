

## Show Published Communications to All Users

### Problem
Currently, the Email, SMS, and WhatsApp tabs on the Communications page are hidden behind the `canManageComms` check (admin/unit leader/WSF leader only). Regular members cannot see any communications sent to them beyond announcements.

### Solution
Add read-only views of communications received by the current user. Regular members will see tabs for SMS, Email, and WhatsApp showing messages sent **to them**, without any compose/send capabilities.

### Changes

#### `src/pages/Communications.jsx`

1. **Unlock tabs for all users** -- Remove the `canManageComms` gate on the Email, SMS, and WhatsApp tab triggers (lines 396-414). All users see all enabled tabs.

2. **SMS tab -- dual view**
   - For admins/leaders: keep existing compose button + ScheduledList
   - For regular members: show a read-only list of SMS messages sent to them, queried from `sms_log` where `recipient_member_id` matches their linked member ID, channel = `sms`
   - Each item is a Card showing: message preview (truncated), status badge, timestamp
   - Clicking opens a detail dialog with full message text

3. **Email tab -- dual view**
   - For admins/leaders: keep existing EmailAlertForm + ScheduledList
   - For regular members: show a read-only list from `email_send_log` where `recipient_email` matches their email
   - Each item shows: template name/subject, status badge, timestamp
   - Clicking opens a detail dialog

4. **WhatsApp tab -- dual view**
   - Same pattern as SMS but filtered by `channel = 'whatsapp'` from `sms_log`

5. **Member lookup** -- Query the current user's member record to get their `id` (for `recipient_member_id`) and `email` (for email log matching). Reuse the existing `myMember` query but expand its select to include `id, email, phone`.

6. **Detail dialogs** -- Add `selectedSmsLog`, `selectedEmailLog` state. Clicking a row opens a Dialog with full message, status, timestamps, and error info if any.

### Technical details

- SMS/WhatsApp query: `sms_log` where `recipient_member_id = myMember.id` and `channel = 'sms'|'whatsapp'`, tenant-scoped, ordered by `created_at desc`, limit 100
- Email query: `email_send_log` where `recipient_email = myMember.email`, tenant-scoped, ordered by `created_at desc`, limit 100
- No RLS changes needed -- `sms_log` and `email_send_log` RLS policies already allow reads for tenant members
- Admin compose forms remain gated behind `canManageComms`

### Files changed
- `src/pages/Communications.jsx` -- unlock tabs for all users, add read-only received message lists for members, add detail dialogs

