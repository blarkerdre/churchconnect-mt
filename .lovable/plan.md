# Low-SMS top-up prompt for church admins

## What you'll see
- **New setting** in Settings, on the text top-up card: "Warn me when texts left fall to" (number, default 20). Church owners and admins can change it; 0 turns the warning off.
- **Top-up prompt**: when texts available (free monthly allowance left + top-up balance) are at or below that number, church owners and admins see an amber banner across the top of the app: "Only 12 texts left. Top up now", with a **Top up** button that goes to the top-up card in Settings. It can be dismissed for the day. At 0 it turns red ("You've run out of texts").
- **Bell notification**: admins also get one in-app notification the first time the balance drops below the level each month, so they find out even if they aren't looking at the banner.
- Members and other roles never see it. Churches with no monthly text limit don't get warnings.

## Technical details
- Migration: `tenants.sms_low_threshold integer not null default 20 check (>= 0)`. Admin UPDATE goes through the existing tenant update policy, with an explicit `.eq("id", tenantId)` guard.
- `SmsTopUpCard.jsx`: add threshold to `useSmsBilling` select; input + Save (same Saving/Saved pattern).
- New `src/components/billing/LowSmsBanner.jsx` mounted in `AppLayout` for tenant owners/admins, using `useSmsBilling` (available = max(0, limit − used) + balance). Dismissal stored in localStorage per tenant per day.
- Bell: in the shared `sms-quota.ts` consume path (edge functions) after each send, if available ≤ threshold and no `sms_low` notification exists this month for the tenant, insert notifications for owners/admins. Redeploy send-sms and the functions that use sms-quota.
- Unit test for the "is low" rule (threshold, 0 = off, unlimited = off).
