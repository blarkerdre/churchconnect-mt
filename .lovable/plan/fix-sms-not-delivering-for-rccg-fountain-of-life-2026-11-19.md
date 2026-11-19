# Fix SMS not delivering for RCCG Fountain of Life

## What is happening
All 3 recent RCCG texts (tonight, 20:27-20:38) went to a Canadian number (+1 647...) and were rejected by Twilio:
"Message cannot be sent with the current combination of 'To' and 'From'".
The church sends from a UK number (+44 7888 873207). UK mobile numbers cannot send texts to Canada/US, so Twilio refuses them. The app and the recipient's number are fine.

## Fix
1. In Twilio, buy a Canadian (or US) phone number with SMS enabled, and make sure Canada is ticked under Messaging > Geo Permissions.
2. Set that number as RCCG's sending number in the church's messaging settings (per-church provider override), keeping the UK number for other churches.
3. Make the app pick the sending number by destination: +1 numbers use the North American number, everything else uses the UK number.
4. Show a clear message in the app when a text fails for this reason ("Your sending number can't reach this country").
5. Re-send a test text to the Canadian member and confirm it shows as delivered.

## Technical details
- Add optional `sms_from_number_na` to the tenant comms override config; in the SMS send function choose `From` based on `To` prefix `+1`.
- Map Twilio error 21612 to a friendly error in sms_log / UI toast.
