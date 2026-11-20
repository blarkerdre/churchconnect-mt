# SMS character counter and two-page warning

## What you'll see
Under every text-message box (Bulk Members, Bulk Non-Members, Individual send, and the existing SMS window):
- A live counter, e.g. "142 / 160 characters - 1 text".
- At 140+ characters (close to the limit): amber note "Nearly 2 texts - keep under 160 characters to send as one."
- Past the limit: red note "This will send as 2 texts per person (costs double)." and the count of texts, e.g. "3 texts".
- Emojis or special symbols lower the limit to 70 characters per text; the counter detects this and says so ("Special characters used - 70 per text").
- Shown for SMS only (not WhatsApp or email).

## Technical details
- New `src/lib/sms-segments.js`: detects GSM-7 vs Unicode, counts extended chars (e.g. € [ ] count as 2), returns length, per-segment limit (160/153 or 70/67), segment count.
- New `src/components/sms/SmsCharCounter.jsx` using semantic tokens.
- Use it in DirectSendPanel.jsx (2 boxes), BulkMembersPanel.jsx, and replace the simple `/160` counter in SMSDialog.jsx.
- Small test file `src/lib/sms-segments.test.js`: 160 plain chars = 1 text, 161 = 2, emoji 70 = 1, 71 = 2.
