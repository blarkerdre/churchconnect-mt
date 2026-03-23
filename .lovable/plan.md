

## Recurrent Events with Notifications and Reminders

### Summary
Add recurrence support to events so admins can create repeating events (weekly, biweekly, monthly) with automatic occurrence generation. Add a reminder/notification system that alerts members before upcoming events via in-app notifications.

### User Flow
1. When creating/editing an event, toggle "Recurring Event" on
2. Choose frequency: Weekly, Biweekly, Monthly
3. Set recurrence end date (or number of occurrences)
4. Optionally enable reminders (1 day before, 3 days before, 1 week before)
5. On save, the system generates individual event rows for each occurrence
6. A scheduled backend function sends reminder notifications before each event

### Database Changes

**Migration: Add recurrence and reminder columns to `events` table**
- `is_recurring` boolean default false
- `recurrence_frequency` text (Weekly, Biweekly, Monthly) nullable
- `recurrence_end_date` date nullable
- `recurrence_parent_id` uuid nullable (self-reference to group occurrences)
- `reminder_days_before` integer[] nullable (e.g. `{1, 3, 7}`)
- `reminder_sent` boolean default false

### Changes

**1. Migration: Add columns to events table**
Add the recurrence and reminder fields listed above.

**2. Update `src/pages/Events.jsx`**
- Update the inline event form to include a "Recurring Event" toggle
- When enabled, show frequency selector and end date
- Show reminder options (checkboxes for 1 day, 3 days, 1 week before)
- On save, if recurring, generate all occurrence rows in a single insert (calculate dates client-side based on frequency and end date)
- Group recurring events visually with a "Recurring" badge
- Parent events show occurrence count

**3. Update `src/components/events/EventFormDialog.jsx`**
- Add the same recurrence section (this dialog is used elsewhere)
- Add reminder options section

**4. New Edge Function: `supabase/functions/send-event-reminders/index.ts`**
- Scheduled via pg_cron to run daily
- Queries events where `event_date` minus `reminder_days_before` equals today and `reminder_sent` is false
- Creates in-app notifications for all users (or scoped by audience)
- Marks reminders as sent to avoid duplicates

**5. pg_cron job for daily reminder check**
- Schedule `send-event-reminders` to run once daily at a sensible time (e.g. 8:00 AM)

### Recurrence Logic
When saving a recurring event:
1. First event is the "parent" (recurrence_parent_id = null)
2. Calculate all future dates based on frequency until recurrence_end_date
3. Insert child events with `recurrence_parent_id` pointing to parent
4. All children inherit title, category, location, time, audience, and reminder settings
5. Editing the parent offers option to update all future occurrences

### Reminder Logic
- Each event can have multiple reminder intervals (e.g. remind 1 day and 7 days before)
- The daily cron function checks: for each event where `event_date - reminder_day = today`, insert a notification for each relevant user
- Uses the existing `notifications` table and `notify_all_users` function (scoped by audience when needed)

### Technical Detail
- Occurrence generation happens client-side on save to keep it simple and avoid needing a separate function
- Maximum occurrences capped at 52 (one year of weekly events) to prevent accidental data bloat
- Deleting a parent event prompts to delete all occurrences
- The reminder cron uses the existing notification infrastructure

