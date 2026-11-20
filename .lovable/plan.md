# Fix Cardiff's Monthly Message Usage (still shows 1/100)

## What's wrong
The Settings page counts texts on its own and only counts ones still marked "sent". My earlier fix changed a different count that this page doesn't use. Delivered texts (73 this month for Cardiff) are still being left out.

## Fix
- On the Settings page, count every text and WhatsApp message this month except failed ones.
- Cardiff will show 74/100 for SMS, and the same fix applies to every church.

## Technical details
- `src/pages/Settings.jsx` lines 1073-1074: replace `.eq("status", "sent")` with `.neq("status", "failed")` for both channels.
