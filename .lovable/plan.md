

## Add "Source" Indicator to Course Registrations

### What changes
Add a "Source" column to the admin Registrations view that shows whether each registrant signed up via the public QR code or through the internal system.

### How it works
- Public registrants are members with `user_id = NULL` (no linked account). The edge function creates members without a `user_id`.
- Internal registrants are members with a `user_id` set (logged-in users who registered themselves).
- Display a badge: **"QR / Public"** (outline style) for `user_id IS NULL`, **"Member"** (default style) for linked members.

### File changes

**`src/pages/ExamManagement.jsx`** — `CourseRegistrationsView` function:
1. Update the query to also select `members(first_name, last_name, email, phone, user_id)` (add `user_id`)
2. Add a "Source" column header to the table
3. Add a `<Badge>` cell showing "QR / Public" or "Member" based on `r.members?.user_id`
4. Add "Source" to the CSV export

### No database changes needed
The distinction already exists in the data (`members.user_id` is null for public registrants).

