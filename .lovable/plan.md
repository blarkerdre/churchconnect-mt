

## App Rating & Feedback Feature

### Overview
Add an in-app rating and feedback system where members can rate the app (1–5 stars) and submit optional text feedback. Admins can view aggregated ratings and individual feedback entries.

### Database

**New table: `app_feedback`**
- `id` (uuid, PK)
- `user_id` (uuid, references auth.users, not null)
- `tenant_id` (uuid, references tenants, not null)
- `rating` (integer, 1–5, not null)
- `comment` (text, nullable)
- `created_at` (timestamptz, default now)
- Unique constraint on `(user_id, tenant_id)` — one rating per user per tenant (can update)

RLS policies:
- Members can insert/update their own row
- Members can select their own row
- Admins can select all rows in their tenant

### New Components

**`src/components/feedback/AppFeedbackDialog.jsx`**
- Star rating selector (1–5 with hover preview)
- Optional comment textarea
- Upserts to `app_feedback` (so users can update their rating)
- Triggered from a button on the Dashboard or My Profile page

**`src/components/feedback/FeedbackSummary.jsx`**
- Admin-only card showing: average rating, total responses, rating distribution bar chart
- Scrollable list of recent feedback with comment text
- Displayed on the Analytics Reports tab

### Page Changes

**`src/pages/Dashboard.jsx`** (or `MemberDashboard.jsx`)
- Add a subtle "Rate this app" prompt card that appears for members who haven't submitted feedback yet

**`src/pages/MyProfile.jsx`**
- Add a small "App Feedback" section where the user can see/edit their rating

**`src/pages/Analytics.jsx`**
- Add `FeedbackSummary` to the Reports tab alongside the Training Gap Report

### Files Changed/Created
- New migration for `app_feedback` table + RLS
- `src/components/feedback/AppFeedbackDialog.jsx` (new)
- `src/components/feedback/FeedbackSummary.jsx` (new)
- `src/pages/Dashboard.jsx` or `src/components/dashboard/MemberDashboard.jsx` (edit)
- `src/pages/MyProfile.jsx` (edit)
- `src/pages/Analytics.jsx` (edit)

