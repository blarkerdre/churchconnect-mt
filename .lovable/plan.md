

## Automated Follow-up Messages for First Timers, New Converts & Visitors

### What this adds
When a member registers (or is updated to) First Timer, New Convert, or Visitor status, the system automatically creates scheduled SMS and/or email messages to that member using editable templates. Admins can customize the message templates and set the delay (e.g., send 1 day after registration, then 7 days later).

### Current state
- The `auto_create_followup` trigger creates a follow-up task and notifies **leaders** — but does NOT send any message to the **member** themselves
- The trigger only handles First Timer and New Convert, not Visitor
- `FollowupMessageDialog` allows manual one-off messages per follow-up
- `followup_scheduled_messages` table and `process-scheduled-followups` cron function already exist for processing queued messages

### Design

#### 1. New table: `followup_message_templates`
Stores admin-editable message templates per tenant, per follow-up type and channel.

```
id, tenant_id, followup_type (First Timer/New Convert/Visitor),
channel (sms/email), subject (email only), message_template,
delay_days (integer, e.g. 1 = send 1 day after registration),
is_active (boolean), sort_order, created_at, updated_at
```

Default seed templates (created on first access or via migration):
- First Timer SMS (day 1): "Hi {name}, thank you for visiting {church}! We'd love to see you again."
- First Timer Email (day 1): Welcome email
- New Convert SMS (day 1): "Congratulations on your new journey..."
- Visitor SMS (day 1): "Thank you for worshipping with us..."

RLS: Admins can manage, authenticated can view (tenant-scoped).

#### 2. Update `auto_create_followup` trigger
- Include `Visitor` status alongside First Timer and New Convert
- Add `Visitor` to the `followup_type` enum
- After creating the followup, also auto-insert rows into `followup_scheduled_messages` by reading active templates from `followup_message_templates` for the matching type
- Each message's `scheduled_at` = `NOW() + (template.delay_days * interval '1 day')`
- Populate `recipient_phone`, `recipient_email`, `recipient_name` from the new member record

#### 3. Settings UI for message templates
Add a new section in Settings (or a sub-tab under Followups) where admins can:
- View all automated message templates grouped by type (First Timer, New Convert, Visitor)
- Edit message text, subject line, delay days
- Toggle templates on/off
- Use placeholders: `{name}`, `{church}` (replaced at send time)

#### 4. Update `process-scheduled-followups` edge function
- Before sending, replace `{name}` and `{church}` placeholders in the message with actual values
- Already handles both SMS and email channels — no major changes needed

#### 5. Show auto-scheduled messages in follow-up detail
- In `FollowupDetailPanel`, show upcoming automated messages for that follow-up with ability to edit/cancel individual messages before they send

### Files to change

**Database migration:**
- Add `Visitor` to `followup_type` enum
- Create `followup_message_templates` table with RLS
- Update `auto_create_followup()` trigger to include Visitor and auto-schedule messages from templates

**Frontend:**
- `src/pages/Settings.jsx` — add "Follow-up Templates" section for managing automated message templates
- `src/components/followups/FollowupDetailPanel.jsx` — show auto-scheduled messages
- `supabase/functions/process-scheduled-followups/index.ts` — add placeholder replacement (`{name}`, `{church}`)

### How it works end-to-end
1. Admin configures templates in Settings (e.g., "Send SMS to First Timers 1 day after registration")
2. New member registers as First Timer → trigger fires
3. Trigger creates follow-up task AND reads active templates → inserts scheduled messages into `followup_scheduled_messages`
4. Cron job (`process-scheduled-followups`) picks up due messages and sends via SMS/email
5. Leaders can see and edit/cancel pending automated messages in the follow-up detail panel

