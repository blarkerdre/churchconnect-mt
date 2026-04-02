

## Add Notification Counters to Communications Tabs

### Problem
The Communications page tabs (Announcements, Email, SMS, WhatsApp) have no indication of how many unread/new messages exist in each channel.

### Solution
Add badge counters next to each tab label showing the count of recent unread items per channel.

### How counts are determined

- **Announcements**: Count of published announcements visible to the user that were created in the last 7 days (simple "recent" heuristic since there's no read-tracking on this page)
- **SMS**: For admins — count of scheduled/processing messages. For members — count of SMS logs received in the last 7 days
- **Email**: Same pattern as SMS but from `email_send_log`
- **WhatsApp**: Same as SMS but filtered by `channel = 'whatsapp'`

### Changes to `src/pages/Communications.jsx`

1. **Compute counts** from already-fetched data where possible:
   - `announcementCount` = `visibleAnnouncements.length` (already loaded)
   - For member SMS/Email/WhatsApp counts, add lightweight `useQuery` calls with `.select('id', { count: 'exact', head: true })` to get counts without fetching full rows

2. **Render badges** on each `TabsTrigger`:
   ```jsx
   <TabsTrigger value="sms" className="gap-1.5 text-xs">
     <MessageSquare className="h-3.5 w-3.5" /> SMS
     {smsCount > 0 && (
       <Badge variant="secondary" className="h-5 min-w-5 px-1 text-[10px]">
         {smsCount}
       </Badge>
     )}
   </TabsTrigger>
   ```

3. **Count queries** (for non-admin members):
   - SMS: `sms_log` where `recipient_member_id = myMember.id`, `channel = 'sms'`, last 30 days, head count
   - WhatsApp: same but `channel = 'whatsapp'`
   - Email: `email_send_log` where `recipient_email = myMember.email`, last 30 days, head count
   - For admins: count scheduled/processing items per channel from `scheduled_communications`

### Files changed
- `src/pages/Communications.jsx` — add count queries and badge counters on tab triggers

