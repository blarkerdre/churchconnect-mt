

## Pastoral Care: Auto-Notify Leaders on New Requests + Assignment Notifications

### What exists today
- **Reassignment notification** works: when a leader reassigns via "Manage Case", `notify-pastoral-assignment` sends email+SMS to the new assignee
- **Status change** triggers in-app notification to the requester (DB trigger `trg_pastoral_care_status_change`)
- **No notification on new request creation**: when a prayer request or pastoral care request is submitted (via `PastoralCareRequestDialog` or the main page "New Request"), the auto-assigned leader gets NO notification at all — no in-app, no email, no SMS
- The `notify-pastoral-assignment` edge function already handles email+SMS but is only called from the "Manage Case" update path, not from new request creation

### What needs to change

#### 1. DB trigger: notify pastoral care leaders on INSERT
Create a trigger