

## Add Scheduled Follow-up Email/SMS for First Timers, New Converts, and Visitors

### Overview
Add the ability to compose, edit, schedule, and send follow-up email and SMS messages directly from the Follow-ups module. This covers both immediate sends and scheduled (future-dated) messages.

### Implementation

#### 1. New database table: `followup_scheduled_messages`
Stores scheduled/sent follow-up messages with fields:
- `id`, `followup_id` (FK), `member_id` (FK), `tenant_id`
- `channel` (enum: `sms`, `email`, `whatsapp`)
- `recipient_phone`, `recipient_email`, `recipient_name`
- `subject` (for email), `message` (body text)
- `scheduled_at` (timestamp — null = send immediately)
- `sent_at`, `status` (draft, scheduled, sent, failed, cancelled)
- `created_by`, `created_at`, `updated_at`
- RLS policies scoped by tenant

#### 2. New transactional email template: `followup-reminder`
A React Email template in `_shared/transactional-email-templates/followup-reminder.tsx` accepting props: `recipientName`, `churchName`, `message`, `followupType`. Registered in `registry.ts`.

#### 3. New edge function: `process-scheduled-followups`
A cron-triggered function (runs every 5 minutes) that:
- Queries `followup_scheduled_messages` where `status = 'scheduled'` and `scheduled_at <= now()`
- For SMS: calls the existing `send-sms` flow via Twilio gateway
- For email: calls `send-transactional-email` with the `followup-reminder` template
- Updates status to `sent` or `failed`

#### 4. New component: `FollowupMessageDialog.jsx`
A dialog for composing/editing follow-up messages with:
- Channel selector (SMS / Email) — shown based on available contact info
- Message body textarea with character count
- Subject line (email only)
- Send option: "Send Now" or "Schedule" with datetime picker
- Pre-filled message templates based on followup type (First Timer / New Convert / Visitor)
- Edit and cancel capabilities for scheduled messages

#### 5. Update `FollowupDetailPanel.jsx`
Add a "Send Message" section in the detail panel:
- "Send Email" and "Send SMS" quick action buttons (shown if contact info exists)
- A "Scheduled Messages" list showing pending/sent messages for this followup
- Ability to edit or cancel scheduled messages

#### 6. Update `Followups.jsx`
- Add the `FollowupMessageDialog` integration
- Add a "Scheduled" indicator badge on followup cards that have pending messages
- Wire up the new dialog from both the card-level SMS button and the detail panel

#### 7. Set up pg_cron job
Schedule `process-scheduled-followups` to run every 5 minutes to process due messages.

### Files to create
- `supabase/migrations/[timestamp].sql` — `followup_scheduled_messages` table + RLS + cron job
- `supabase/functions/_shared/transactional-email-templates/followup-reminder.tsx` — email template
- `supabase/functions/process-scheduled-followups/index.ts` — cron dispatcher
- `src/components/followups/FollowupMessageDialog.jsx` — compose/edit/schedule dialog

### Files to modify
- `supabase/functions/_shared/transactional-email-templates/registry.ts` — register new template
- `src/components/followups/FollowupDetailPanel.jsx` — add message actions and scheduled list
- `src/pages/Followups.jsx` — integrate new dialog, add scheduled badge

### Message templates (pre-filled based on type)

**First Timer:**
> Hi {name}, thank you for visiting {churchName}! We'd love to see you again this Sunday. If you have any questions, please don't hesitate to reach out.

**New Convert:**
> Hi {name}, congratulations on your new journey of faith at {churchName}! We'd love to help you get connected. Have you considered joining our Believers Foundation Class?

**Visitor:**
> Hi {name}, it was wonderful having you at {churchName}. We hope you felt welcomed. We'd love to see you again soon!

### Technical notes
- SMS uses existing Twilio integration via `send-sms` edge function patterns
- Email uses `send-transactional-email` with the new `followup-reminder` template
- Scheduled messages are tenant-scoped with proper RLS
- The cron function uses service-role key from vault (same pattern as `process-email-queue`)

