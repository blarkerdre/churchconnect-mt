# Make the low call-minute alert work like the text alert

## What changes for church owners and admins
- **Settings → Billing → Phone call minutes**: the large "Low minutes alert" box is replaced by the same simple line the texts section uses:
  "Warn me when minutes left fall to [ 30 ] [Save]" — with the note "Admins see a top-up reminder and get a notification at this level. Set 0 to turn off."
- **Top-of-page reminder**: like the "Only X texts left" strip, owners and admins see a strip across every page: "Only X call minutes left. Top up to keep calling." (red "You've run out of call minutes." when empty), with a **Top up** button to Billing and an X to hide it for the day.
- **Notification**: one bell notification to owners and admins when the level is reached, and one when minutes run out — no repeat until topped up or the new month (same as today).
- Removed: channel choices (email/text), recipient choices, custom wording and "Send test to me", since the text alert has none of these.
- Churches with unlimited minutes never see the line or strip.

## Technical details
- New `src/lib/call-low.js` (`callLowState`, mirrors `smsLowState`) + `call-low.test.js` (low at threshold, not low above, empty at 0, off when threshold 0 or unlimited).
- New `LowCallBanner.jsx` mounted in `AppLayout.jsx` next to `LowSmsBanner` (admins/owners, hidden when billing or calls module is disabled); reads allowance, `call_minutes_used`, balance and threshold.
- `CallTopUpCard.jsx`: drop `CallLowAlertSettings`, add the threshold input saving `call_low_alert_settings = { enabled: thr>0, threshold, channels:{bell:true}, recipients:{owner:true,admin:true} }` (no schema change; existing guard trigger validates/reset logic kept). Threshold 0 allowed by relaxing the guard's range to 0–10000 (small migration).
- `notify-low-call-minutes`: fixed bell-only to owners/admins, built-in wording; test mode removed. Queue/trigger unchanged.
- Delete `CallLowAlertSettings.jsx`; update AGENTS.md rule wording if needed.
