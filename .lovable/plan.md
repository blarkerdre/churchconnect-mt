

## Plan: Remove SMS & WhatsApp History from Communications Page

### What
Remove the "SMS History" and "WhatsApp History" buttons and their associated dialogs from the Communications page. History is already available in the System Logs page.

### Changes

**File: `src/pages/Communications.jsx`**

1. Remove the `SMSHistoryDialog` import (line 25)
2. Remove the `History` icon import from lucide-react (line 11)
3. Remove state variables: `historyOpen` (line 42), `waHistoryOpen` (line 44)
4. Remove the "SMS History" button block (lines 319-323) in the SMS tab
5. Remove the "WhatsApp History" button block (lines 340-344) in the WhatsApp tab
6. Remove the two `<SMSHistoryDialog>` component instances (lines 375 and 387)

No database or migration changes needed.

