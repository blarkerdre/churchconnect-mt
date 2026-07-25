## Goal
Let members tap/click a birthday celebrant's avatar on the dashboard to view their picture full-size in a lightbox.

## Changes
- `src/components/dashboard/BirthdayCelebration.jsx`
  - In `UpcomingBirthdayItem`, wrap the `MemberAvatar` in a button that opens a fullscreen image lightbox (following the existing image-lightbox UI pattern).
  - Use the member's `photo_url` if present; fall back to an initials avatar card if there's no photo (in that case, no lightbox — nothing to enlarge).
  - Lightbox shows the photo centered on a dark overlay, with the celebrant's name and "🎂 Today!" / date caption, and a close button (also closes on backdrop click / Esc).
  - Add a small visual affordance (cursor-pointer + subtle ring on hover) so it's clear the avatar is tappable.

## Scope guardrails
- Only presentation/UI change in `BirthdayCelebration.jsx`. No DB, RLS, or data-fetching changes — `get_upcoming_birthdays` already returns `photo_url`.
- Applies to both "Today's Birthdays" (all members) and unit-leader "Upcoming Birthdays" since both render `UpcomingBirthdayItem`.
