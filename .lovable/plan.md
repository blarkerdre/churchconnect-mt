

## Plan: Per-Tenant Email Sender Name and Twilio Numbers

### What We're Building

1. **Custom email sender name** -- each tenant can set a display name (e.g. "LFC Cardiff") that appears in the From field of all outgoing emails instead of the hardcoded "Winners Chapel International Cardiff"
2. **Per-tenant Twilio numbers** -- each tenant can configure their own SMS number and WhatsApp number, overriding the global defaults

### Storage Approach

Use the existing `tenants.settings` JSONB column to store:
```json
{
  "email_sender_name": "LFC Cardiff",
  "twilio_sms_from": "+44...",
  "twilio_whatsapp_from": "+44...",
  "features": { ... }
}
```

No database migration needed -- the column already exists.

### Changes

**1. Settings UI -- new "Communications" tab** (`src/pages/Settings.jsx`)
- Add a new tab between "Notifications" and "Units" with a Mail/Phone icon
- Three fields:
  - Email Sender Name (text input, placeholder: church name)
  - SMS From Number (text input, E.164 format)
  - WhatsApp From Number (text input, E.164 format)
- Save button that updates `tenants.settings` JSONB, merging with existing keys
- Show current global defaults as placeholders when tenant values are empty
- Admin-only section

**2. Edge Function: `send-email-alert`** (`supabase/functions/send-email-alert/index.ts`)
- Fetch the tenant's settings from the `tenants` table using `tenant_id`
- Use `settings.email_sender_name` (falling back to tenant `name`, then the hardcoded default) for the From display name and the email template header
- Replace the hardcoded "Winners Chapel International Cardiff" in HTML/text templates

**3. Edge Function: `send-sms`** (`supabase/functions/send-sms/index.ts`)
- After auth check, if `tenant_id` is provided, fetch `tenants.settings` for that tenant
- Use `settings.twilio_sms_from` as the From number for SMS (fallback: global `TWILIO_FROM_NUMBER`)
- Use `settings.twilio_whatsapp_from` as the From number for WhatsApp (fallback: global `TWILIO_WHATSAPP_FROM`)

**4. Other email-sending edge functions** -- search for other functions that hardcode the sender name and update them similarly:
- `send-welcome-email`
- `notify-followup-assignment`
- `notify-pastoral-assignment`
- `send-event-reminders`
- `send-course-registration-email`

Each will look up the tenant's `email_sender_name` from `tenants.settings` when `tenant_id` is available.

### Technical Details

- Settings UI reads/writes to `tenants` table directly (already has RLS for admins)
- Edge functions use service role client to read tenant settings -- single query, cached per request
- No new secrets or environment variables needed
- Twilio numbers are stored as plain text in settings -- they are not secrets (they're visible in SMS headers anyway)
- Validation: SMS/WhatsApp numbers must match E.164 format before saving

