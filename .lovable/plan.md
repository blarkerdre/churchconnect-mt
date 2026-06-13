## Children Church — Share Pickup Code

Add share controls to the drop-off success screen so parents can easily send the pickup PIN to another adult.

### What to build
1. **Copy to clipboard** button next to the displayed PIN.
   - Copies a formatted message: child name(s), PIN, and a short "show this at pickup" note.
   - Shows a toast confirmation.

2. **Native share** button (Web Share API) with graceful fallback.
   - On supported mobile browsers, opens the OS share sheet (WhatsApp/SMS/email).
   - On unsupported browsers, the button is hidden so the UI is clean.
   - Wrap `navigator.share` in `try/catch`; on permission errors or aborts, silently do nothing.

### Where
`src/pages/ChildrenChurch.jsx` — inside the `CheckInPanel` success state (the block shown after `issuedPin` is set).

### No database changes
All changes are frontend-only. The PIN is already generated and stored in `child_checkins.pin`.