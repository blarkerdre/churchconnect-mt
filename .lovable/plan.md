

## Show Feedback Author Names

### Problem
The feedback summary shows comments without identifying who submitted them.

### Solution
Join `app_feedback` with `members` (via `user_id`) to retrieve the submitter's name, and display it alongside each feedback entry.

### Changes

**`src/components/feedback/FeedbackSummary.jsx`**

1. Update the query to fetch member name by doing a second query or a manual join:
   - After fetching feedback, fetch members for those `user_id`s from the `members` table (since there's no FK relationship for a direct Supabase join)
   - Build a `user_id → name` map

2. Display the name in two places:
   - In the **Recent Comments** section: show the person's name below each comment
   - In the full feedback list: add a name column/label next to each rating

### Technical Detail
- Query `members` table filtered by `tenant_id` and `user_id IN (feedback user_ids)` to get `first_name`, `last_name`
- Fall back to "Anonymous" if no member record is found
- The admin SELECT policy on `app_feedback` already allows admins to see all tenant feedback; the `members` table is also accessible to admins

### Files Changed
- `src/components/feedback/FeedbackSummary.jsx` — add member name lookup and display

