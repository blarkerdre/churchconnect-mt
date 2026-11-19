# Make the SMS pricing Save button show clearly that the price was saved

## What I found
Saving does work: RCCG Fountain of Life and Demo Church (TEST) both have 0.90 USD per text stored. The problem is that the screen gives no clear sign of it. The button looks the same before and after, the box looks unchanged, and the small pop-up message is easy to miss on a phone.

## Change (Tenant Admin → SMS pricing)
- The Save button shows "Saving..." while it works, then "Saved ✓" for a few seconds.
- Save is greyed out until the price is actually changed, so it's obvious when there is something new to save.
- A line under the box shows the price currently in use, e.g. "Current price: $0.90 per text (church price)" or "(plan price)" when left blank. It updates right after saving.
- The "Price per text" figure on the text card below updates at the same time.
- If saving fails, a red message appears next to the button, not only in the pop-up.
- The Billing currency Save button gets the same "Saving... / Saved ✓" behaviour.

## Technical details
- `src/components/billing/SmsPricingAdmin.jsx` only: separate saving states for price and currency, a `savedAt` flag with a 3-second timer, `dirty` check against `sms_unit_price_override`, inline error text, and `await qc.invalidateQueries(["sms-billing", tenantId])` before the Saved state shows.
- Update query uses `.select()` so a zero-row update (no permission) is reported as an error instead of a silent success.
- No database changes.
