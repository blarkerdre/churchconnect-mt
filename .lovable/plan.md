# Subscription renewal reminder for church admins

## What you'll see
- **New setting** in Settings → Billing: "Remind me this many days before renewal" (default 7; 0 turns it off). Church owners and admins can change it.
- **Banner**: from that many days before the next payment date, owners and admins see a banner at the top of the app: "Your subscription renews in 5 days (25 Nov 2026) – £49.00", with a **Renew / Pay** button that opens Settings → Billing. It can be hidden for the day. On the due date it reads "due today"; once overdue it turns red ("payment overdue by 2 days").
- Churches paying automatically by card see a softer note ("Your card will be charged on 25 Nov") instead of a payment prompt.
- **Bell notification**: one notification to owners and admins when the reminder window starts for each renewal date.
- Members never see it.

## Technical details
- Migration: `tenants.renewal_reminder_days integer not null default 7 check (0..90)`.
- Daily check (once a day, 1 run/day) using pg_cron calling a SQL function: for each active `tenant_subscriptions` row where `next_due_date - today <= renewal_reminder_days` and no `subscription_renewal` notification exists for that due date (stored in `reference_id`), notify owners/admins.
- New `src/lib/renewal-reminder.js` (days-left / overdue / off rule) with unit tests.
- New `src/components/billing/RenewalBanner.jsx` in `AppLayout` next to the low-texts banner; reads the tenant's active subscription with an explicit `tenant_id` guard. Hidden when the existing past-due banner already shows.
- Setting input + Save in the Billing card (same Saving/Saved pattern as the low-texts setting).
