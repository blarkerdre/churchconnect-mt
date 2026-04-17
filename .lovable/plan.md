
The user wants to:
1. Move the "Rate this app" prompt out of the dashboard (currently in `MemberDashboard.jsx`) into the sidebar
2. Allow members to see their feedback history (currently `app_feedback` table allows users to view their own — already supported by RLS)

Let me check the sidebar structure and existing feedback dialog.

I need to look at:
- `src/components/AppLayout.jsx` — sidebar location
- `src/components/feedback/AppFeedbackDialog.jsx` — current feedback dialog
- `src/components/dashboard/MemberDashboard.jsx` — current rate prompt to remove

The feedback dialog likely only handles one submission. I'll need to enhance it (or create a new component) to show history + allow new submissions.

## Plan

### 1. Sidebar entry (`src/components/AppLayout.jsx`)
Add a "Feedback" item in the sidebar footer area (near Sign Out / Profile) with a Star icon, visible to all authenticated members. Clicking opens a feedback dialog with two tabs: **Submit** and **History**.

### 2. Enhance `AppFeedbackDialog.jsx`
Convert the dialog to use tabs:
- **Submit / Edit tab** — existing rating + comment form. If user has prior feedback, prefill latest one (already has update permission via RLS).
- **History tab** — list of all the user's past submissions (rating, comment, date, admin response if any) ordered newest first. Read-only.

Query: `supabase.from("app_feedback").select("*").eq("user_id", userId).eq("tenant_id", tenantId).order("created_at", { ascending: false })`

If admin has responded (`admin_response` field), show it inline beneath each entry as a quoted reply.

### 3. Remove from dashboard (`src/components/dashboard/MemberDashboard.jsx`)
- Remove the "Enjoying the app?" Card block
- Remove `feedbackOpen` state, `existingFeedback` query, `AppFeedbackDialog` import and instance
- Remove the unused `Star` import

### 4. Mobile bottom nav consideration
The mobile bottom nav (`MobileBottomNav.jsx`) is full (5 tabs). We'll keep feedback sidebar-only; on mobile users open the sidebar sheet to access it. No changes to bottom nav.

### Why this works
- `app_feedback` RLS already allows `Users can view own feedback` and `Users can update own feedback` — no DB changes needed.
- `admin_response` column already exists, so showing admin replies in history is free.
- Sidebar is the natural home for app-level utilities (feedback, settings, sign out).

### Files Changed
- `src/components/AppLayout.jsx` — add Feedback button in sidebar footer (~10 lines)
- `src/components/feedback/AppFeedbackDialog.jsx` — add Tabs with Submit + History views (~60 lines)
- `src/components/dashboard/MemberDashboard.jsx` — remove rate-app card and related state/imports (~20 lines removed)
