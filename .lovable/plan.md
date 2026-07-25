# Profile cleanup + Dashboard birthdays

## 1. `src/pages/MyProfile.jsx` — remove Bible School and App Feedback

- Remove the `AppFeedbackDialog` import and the `<AppFeedbackSection />` render at line ~673.
- Remove the `AppFeedbackSection` component definition (lines ~1161–1204).
- Remove the Bible School card in the profile view (the `<Card>` starting at ~line 1062 with `<BookOpen /> Bible School` — including the whole `registeredCourses.map` block and its "Print Statement" logic). Keep the certificates and take-exam sections intact.
- Keep "Bible School" as a membership status option and the Bible School toggles inside the edit form (BCC/LCC/LDC switches at ~540) — those are member data, not the read-only Bible School results panel the user wants removed.

If removing the results panel leaves an unused component/helpers (e.g. `registeredCourses` query, print helpers, `BookOpen` import), drop those too so lint stays clean.

## 2. `src/components/dashboard/MemberDashboard.jsx` — add App Feedback + today's celebrants

- Add a new `AppFeedbackSection`-style card at the bottom of the dashboard (below Spiritual Development). Reuse the same UI/behaviour that lived in MyProfile: shows current rating or "Rate" CTA, opens `AppFeedbackDialog`. Simplest path: export `AppFeedbackSection` from a new file `src/components/feedback/AppFeedbackSection.jsx` (moved verbatim from MyProfile) and import it in both the dashboard and (as removal) drop it from MyProfile.
- Add a "Today's Birthdays" card visible to **all** members (not gated by `showBirthdays`). Use existing `get_upcoming_birthdays` RPC with `_days_ahead: 0` (or filter client-side to entries whose month+day match today). Render each celebrant with `UpcomingBirthdayItem` (already shows `MemberAvatar` photo). Hide the card when the list is empty. Place it just below the Welcome banner / BirthdayBanner so it's prominent.
- Keep the existing personal `BirthdayBanner` (shown when it's the signed-in member's birthday) and the unit-leader "Upcoming Birthdays" card unchanged.

## Technical notes

- `UpcomingBirthdayItem` already uses `MemberAvatar` → signed photo URLs work automatically, no extra work needed.
- `get_upcoming_birthdays(_tenant_id, _days_ahead)` is already used elsewhere; passing `0` returns today's celebrants for the tenant. If the RPC returns a wider window, filter client-side by comparing `date_of_birth`'s month/day to today.
- No DB migration, no RLS changes, no new tables.
