# Fix "0 sent" count on System Logs (SMS and WhatsApp tabs)

## Cause (confirmed)
The "sent" badge only counts messages whose status is exactly "sent". When the phone network confirms a text arrived, its status changes to "delivered". In the last 30 days, 99 texts are "delivered" and only 7 are still "sent", so the badge shows 0 for this week even though all the texts listed went out.

## Change
- SMS tab: the badge counts every message that went out (sent, delivered or still queued), excluding failed and undelivered ones. The "failed" badge also counts "undelivered".
- WhatsApp tab: same fix, since it uses the same counting.
- Add "Birthday" and "Direct" to the type filter so the types shown in the list can be filtered.

## Technical details
- src/pages/SystemLogs.jsx lines ~252 and ~336: sentCount = logs where status != "failed" and delivery_status not in ("failed","undelivered"); failedCount = the rest.
- Type filter list (~line 262): add "birthday", "direct".
