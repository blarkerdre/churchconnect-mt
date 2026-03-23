

## Plan: WhatsApp Channel Integration via Twilio

### Overview
Add a channel toggle (SMS / WhatsApp) to the messaging dialog and update the edge function to route messages through Twilio's WhatsApp API when selected. Uses the same `/Messages.json` endpoint — only the `To` and `From` fields change.

### Prerequisites
A new secret `TWILIO_WHATSAPP_FROM` is needed for the WhatsApp sender number (e.g. `whatsapp:+14155238886` for Twilio sandbox, or `whatsapp:+447888873207` if your number is WhatsApp-approved).

### Changes

**1. Database migration — add `channel` column to `sms_log`**
```sql
ALTER TABLE public.sms_log ADD COLUMN channel text NOT NULL DEFAULT 'sms';
```
No RLS changes needed — existing policies cover new columns automatically.

**2. Edge function: `supabase/functions/send-sms/index.ts`**
- Accept `channel` field in request body (`"sms"` or `"whatsapp"`, default `"sms"`)
- When `channel === "whatsapp"`:
  - Prefix `To` with `whatsapp:`
  - Use `TWILIO_WHATSAPP_FROM` env var as `From` (already includes `whatsapp:` prefix)
- Otherwise use existing `TWILIO_FROM_NUMBER`
- Include `channel` in the log objects inserted into `sms_log`

**3. Frontend: `src/components/sms/SMSDialog.jsx`**
- Add `channel` state (`"sms"` or `"whatsapp"`)
- Add a segmented toggle (using RadioGroup or simple button group) above the message textarea
- Pass `channel` in the fetch body to the edge function
- Update button text: "Send SMS" vs "Send WhatsApp"
- Reset channel on dialog open

**4. Frontend: `src/components/sms/SMSHistoryDialog.jsx`**
- Show a small badge (SMS / WhatsApp) on each log entry using the `channel` column
- Add "whatsapp" to the type filter options

**5. Secret: `TWILIO_WHATSAPP_FROM`**
- Use `add_secret` tool to request the WhatsApp sender number from the user

### Technical Detail
The Twilio WhatsApp API uses the same Messages endpoint. The only difference:
```
SMS:      To=+447123456789       From=+447888873207
WhatsApp: To=whatsapp:+447123456789  From=whatsapp:+14155238886
```

