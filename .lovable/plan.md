

## Fix: Follow-up SMS Failing Due to Invalid Phone Numbers

### Root cause
The edge function logs show: `Twilio error: Invalid 'To' Phone Number: X`. The `process-scheduled-followups` function sends SMS without validating that the recipient phone is a valid E.164 number first. Invalid/placeholder phones (like "X") get passed straight to Twilio, which rejects them.

Additionally, the `auto_create_followup` trigger blindly copies `NEW.phone` into `followup_scheduled_messages.recipient_phone` without any validation, so SMS messages get scheduled even when the member has no usable phone number.

### Fix

**1. `supabase/functions/process-scheduled-followups/index.ts`** — Add phone validation before sending SMS
- After phone normalization, validate with E.164 regex (`/^\+[1-9]\d{6,14}$/`)
- If invalid, throw a clear error (`"Invalid or missing phone number"`) so the message is marked `failed` with a useful error message instead of wasting a Twilio API call
- This prevents Twilio billing for known-bad numbers

**2. Database trigger improvement (migration)** — Skip scheduling SMS for members without valid phones
- Update `auto_create_followup` to only insert SMS-channel `followup_scheduled_messages` rows when `NEW.phone` is not null and passes a basic validation pattern
- Email messages are still scheduled regardless of phone validity

### Files changed
- `supabase/functions/process-scheduled-followups/index.ts` — add E.164 validation before Twilio call
- 1 new migration — update `auto_create_followup` trigger to skip SMS scheduling for invalid/missing phones

