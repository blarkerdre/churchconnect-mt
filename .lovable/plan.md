

## Plan: Clean Up SMS/WhatsApp UI

### Changes

**1. `src/components/sms/SMSDialog.jsx`** (lines 175-202)
- Remove the channel toggle UI (the SMS/WhatsApp button pair) entirely
- The channel will be determined solely by the `defaultChannel` prop — no user-facing option to switch

**2. `src/pages/Communications.jsx`**
- Line 235-236: Change WhatsApp tab icon from `Phone` to `MessageSquare`
- Line 252: Change "New Communication" to "New Announcement"

### Summary
Three small UI tweaks — no logic or backend changes.

