

## Add "Visitor" Status + Schedule Send to All Communication Channels

### Changes

#### 1. Add "Visitor" to AudienceFilter status options
**`src/components/comms/AudienceFilter.jsx`** — Add `{ value: "Visitor", label: "Visitor" }` to `STATUS_OPTIONS`.

#### 2. Add scheduling UI to EmailAlertForm
**`src/components/comms/EmailAlertForm.jsx`**:
- Add a "Send Now / Schedule" toggle (radio group or switch)
- When "Schedule" is selected, show a date picker + time input for choosing when to send
- On schedule: insert into a new `scheduled_communications` table instead of calling `send-email-alert` immediately
- Button label changes to "Schedule Email" with scheduled date/time shown

#### 3. Add scheduling UI to SMSDialog
**`src/components/sms/SMSDialog.jsx`**:
- Same "Send Now / Schedule" toggle below the message textarea
- Date + time picker when scheduling
- On schedule: insert into `scheduled_communications` with `channel: 'sms'` or `'whatsapp'`
- Button label: "Schedule for [date]" vs "Send Now"

#### 4. Create `scheduled_communications` table
**Database migration**:
```sql
CREATE TABLE public.scheduled_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) NOT NULL,
  channel text NOT NULL,        -- 'email', 'sms', 'whatsapp'
  filters jsonb DEFAULT '{}',   -- {status, unit, dateFrom, dateTo}
  subject text,                 -- email only
  message text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  sent_at timestamptz,
  error_message text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.scheduled_communications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant access" ON public.scheduled_communications
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid()));
```

#### 5. Create cron edge function to process scheduled messages
**`supabase/functions/process-scheduled-communications/index.ts`**:
- Query `scheduled_communications` where `status = 'scheduled'` and `scheduled_at <= now()`
- For email: invoke `send-email-alert` with stored filters/subject/body
- For SMS/WhatsApp: query members with filters, then invoke `send-sms`
- Update status to `sent` or `failed`
- Set up pg_cron job to run every 5 minutes

#### 6. Add scheduled communications list to Communications page
**`src/pages/Communications.jsx`**:
- Show a small "Scheduled" section in each tab listing upcoming scheduled messages with cancel option

### Files changed
- `src/components/comms/AudienceFilter.jsx` — add Visitor
- `src/components/comms/EmailAlertForm.jsx` — add schedule toggle + date/time picker
- `src/components/sms/SMSDialog.jsx` — add schedule toggle + date/time picker
- `src/pages/Communications.jsx` — show scheduled items list
- 1 migration — `scheduled_communications` table + RLS
- `supabase/functions/process-scheduled-communications/index.ts` — new cron processor
- pg_cron job insert

