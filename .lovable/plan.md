
## Goal
Give Unit Leaders and Home Cell Leaders a first-class workspace to manage referrals signposted to them — see history, contact the member, acknowledge, post updates, and (one click) add the member to their unit/centre.

## Investigation summary
- `followup_referrals` already exists with `assigned_leader_id`, `referral_type` (`unit_leader` | `home_cell_leader`), `target_unit_name`, `target_wsf_centre_id`, `status`, `member_id`, `referred_by`, `created_at`, `tenant_id`.
- `followup_referral_updates` already exists with `referral_id`, `update_text`, `status_change`, `author_id`, `tenant_id` — and triggers `apply_referral_status_change` + `notify_referral_update_added` already wire updates back to the original referrer. ✅
- `SignPostedToMeWidget` exists on the dashboard but is read-only (just a list).
- No detail dialog, no acknowledge action, no "add to my unit/centre" action exists today.
- Members table has `church_unit` (text) and `wsf_centre_id` (uuid) — both updatable.

## Plan

### 1. New component: `SignPostInboxDialog.jsx`
A full-screen referral inbox for the leader, opened from the dashboard widget's "View all" button (and a new sidebar entry for leaders). Lists all referrals where `assigned_leader_id = me`, grouped by status (New / In Progress / Completed). Each row shows member name, type, target unit/centre, who referred them, age.

Click a row → opens **referral detail panel**.

### 2. New component: `SignPostDetailPanel.jsx` (slide-over)
For one referral, shows:
- **Member contact card**: name, phone (click-to-call), email (click-to-mail), preferred contact mode, current `church_unit` / `wsf_centre`, membership status.
- **Referral context**: who referred them, when, target (unit name or centre name), original notes from the sign-post.
- **History timeline**: all `followup_referral_updates` for this referral (text + status change + author + date).
- **Action bar**:
  1. **Acknowledge** — posts an update (`"Acknowledged by {leader}"`) and sets status to `In Progress`. One click.
  2. **Post Update** — textarea + status select (`In Progress` / `Completed` / `Declined`), inserts row into `followup_referral_updates`. The existing trigger automatically updates referral status and notifies the referrer.
  3. **Add to my Unit / Home Cell** — context-aware:
     - For `unit_leader` referrals: button "Add to {target_unit_name}" → updates `members.church_unit` (appending if member already has units, comma-separated, deduped case-insensitive).
     - For `home_cell_leader` referrals: button "Add to {centre name}" → updates `members.wsf_centre_id` and sets `winners_satellite = true`.
     - After success, automatically posts an update `"Member added to {target}"` and marks referral `Completed`.
  4. **Create Follow-up** — opens the existing `FollowupFormDialog` pre-filled with this member, assigned to the leader. Lets them schedule a call/visit.

### 3. Wire it up
- **Dashboard widget** (`SignPostedToMeWidget.jsx`): each row becomes clickable → opens `SignPostDetailPanel`. Add a "View all" footer link → opens `SignPostInboxDialog`.
- **Sidebar**: add "Sign-Post Inbox" nav entry visible when `isUnitLeader || isWsfLeader`, with a badge for new referrals (status = `Pending`).
- **Permissions**: existing RLS on `followup_referrals` already restricts to `assigned_leader_id = auth.uid()` for leaders; verify and adjust if needed (will check during implementation, may need a small policy tweak — flag in plan).

### 4. RLS check (may need migration)
Need to confirm `followup_referrals` UPDATE policy allows the assigned leader to change `status`, and `followup_referral_updates` INSERT allows the assigned leader to add updates. Also `members` UPDATE for the leader to change `church_unit` / `wsf_centre_id` of the referred member — this likely needs a new policy: "assigned referral leader may update target unit/centre fields on the referred member". I'll add a focused migration if missing.

### 5. Notifications
Already covered by existing triggers — the referrer gets a notification when a leader posts an update. No new edge function needed.

## Files
- **New**: `src/components/followups/SignPostInboxDialog.jsx`
- **New**: `src/components/followups/SignPostDetailPanel.jsx`
- **Edit**: `src/components/dashboard/SignPostedToMeWidget.jsx` — make rows clickable, add "View all" button
- **Edit**: `src/components/AppLayout.jsx` (or sidebar component) — add "Sign-Post Inbox" entry for leaders with unread badge
- **Possible migration**: tighten/expand RLS on `followup_referrals`, `followup_referral_updates`, and a narrow `members` update policy for assigned leaders (only verified during implementation)

No changes to `SignPostDialog.jsx` or `FollowupDetailPanel.jsx`.
