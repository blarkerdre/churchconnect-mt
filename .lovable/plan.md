

## Plan: Use WhatsApp Brand Icon

Lucide doesn't include a WhatsApp icon. I'll create a small inline SVG component for the WhatsApp logo and use it in place of `MessageSquare` in the WhatsApp tab and button.

### Changes

**`src/pages/Communications.jsx`**
- Add a small `WhatsAppIcon` component using the official WhatsApp SVG path (the phone-in-speech-bubble logo)
- Replace `MessageSquare` with `WhatsAppIcon` in:
  - The WhatsApp `TabsTrigger` (line 236)
  - The "Send Bulk WhatsApp" button (line 322)
  - The placeholder card icon (around line 326)

