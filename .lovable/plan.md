

## Plan: Add WhatsApp as a Separate Tab in Communications

### What Changes
Add a "WhatsApp" tab alongside Email and SMS in the Communications page tab bar.

### Changes

**`src/pages/Communications.jsx`**
- Add a new `TabsTrigger` for "whatsapp" with a WhatsApp-style icon (reuse `MessageSquare` or use a phone icon) after the SMS tab trigger
- Add a new `TabsContent` for "whatsapp" — similar to the existing SMS tab content but with the SMSDialog pre-set to WhatsApp channel
- Add state for a separate WhatsApp dialog (`waOpen`) or reuse `smsOpen` with a default channel parameter
- The WhatsApp tab content will mirror the SMS tab layout: a "Send Bulk WhatsApp" button and a placeholder card, plus SMS History button filtered to WhatsApp

This is a small UI restructuring — no backend or database changes needed.

