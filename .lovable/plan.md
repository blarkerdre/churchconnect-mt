

# SMS Notifications via Twilio

## Overview
Add SMS capabilities to the church management app using the Twilio connector, enabling admins and unit leaders to send SMS notifications for announcements, events, follow-ups, and bulk messaging to members with phone numbers.

## Architecture

```text
Frontend (SMS dialogs/buttons)
  → Edge Function (send-sms)
    → Twilio Connector Gateway
      → Twilio API → Member phones
```

## Database Changes

1. **New `sms_log` table** to track sent messages:
   - `id`, `sender_id` (uuid), `recipient_phone` (text), `recipient_member_id` (uuid, nullable), `message` (text), `sms_type` (text: announcement, event, followup, bulk), `reference_id` (text, nullable), `status` (text: sent, failed), `error_message` (text, nullable), `created_at`
   - RLS: admins/leaders can insert and view; no public access

## Edge Function: `send-sms`

- Single edge function that accepts `{ to: string | string[], message: string, sms_type: string, reference_id?: string }`
- Supports single and bulk sending (loops through recipients)
- Uses Twilio connector gateway with `LOVABLE_API_KEY` and `TWILIO_API_KEY`
- Logs each SMS to `sms_log` table
- Returns success/failure counts

## Frontend Components

### 1. `SMSDialog` (reusable dialog component)
- Compose message with character count (160 char SMS segments indicator)
- Audience selector (same unit-based audiences as announcements)
- Preview recipient count (members with phone numbers in selected audience)
- Send button that calls the edge function
- Shows delivery results (sent/failed counts)

### 2. SMS buttons integrated into existing pages:
- **Communications page**: Add "Send SMS" tab/button alongside announcements, with bulk SMS compose form
- **Events page**: "Notify via SMS" button on each event card — pre-fills message with event details (title, date, location)
- **Announcements**: "Send as SMS" button on each announcement card — pre-fills message with announcement content
- **Follow-ups page**: "SMS Reminder" button on follow-up cards — sends reminder to the assigned member's linked member record phone number

### 3. `SMSHistoryDialog`
- View sent SMS log with filters by type, date
- Accessible from Communications page

## Connector Setup
- Will use `standard_connectors--connect` with `twilio` connector_id
- User will need a Twilio account with a phone number configured

## Implementation Steps
1. Connect Twilio connector
2. Create `sms_log` database table with RLS
3. Create `send-sms` edge function
4. Build reusable `SMSDialog` component
5. Add SMS buttons to Communications, Events, Announcements, and Follow-ups pages
6. Add SMS history view

## Security
- Only admins and unit leaders can send SMS (enforced via edge function JWT check + RLS)
- Unit leaders restricted to their own unit audiences
- Phone numbers never exposed to client beyond what members table already shows

