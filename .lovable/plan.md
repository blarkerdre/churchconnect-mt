## Goal

Move the member "App Feedback" entry from the dashboard card into the sidebar, sharing the same Feedback button admins already use.

## Changes

1. **`src/components/AppLayout.jsx`**
   - Remove the `isAdmin` gate on the Feedback button (lines ~399–408) so every signed-in user sees it.
   - `AppFeedbackDialog` already handles both submission and history for any user, so no other wiring changes are needed.

2. **`src/components/dashboard/MemberDashboard.jsx`**
   - Remove the `<AppFeedbackSection />` render (and its import) from the bottom of the dashboard, since feedback now lives in the sidebar.

## Not changing

- `AppFeedbackSection.jsx` file stays in place (unused after this change) in case it's referenced elsewhere; it can be deleted later if desired.
- Admin feedback review UI (FeedbackSummary) is untouched.
