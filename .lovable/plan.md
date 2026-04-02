

## View Full Follow-up SMS and Email Messages

### Problem
In the follow-up detail panel, scheduled messages are truncated to 2 lines (`line-clamp-2` on line 353). Users cannot read the full SMS or email content that was sent or scheduled.

### Solution
Add a detail dialog that opens when a user clicks on a message in the Messages section. The dialog shows the full, untruncated message along with all metadata.

### Changes to `src/components/followups/FollowupDetailPanel.jsx`

1. Import `Dialog, DialogContent, DialogHeader, DialogTitle` from UI components
2. Add `selectedMessage` state
3. Make each message card clickable — clicking sets `selectedMessage` and opens the dialog
4. The dialog displays:
   - Channel badge (EMAIL/SMS) and status badge
   - Recipient (email or phone)
   - Subject line (for email messages)
   - Full message body (`whitespace-pre-wrap`, no truncation)
   - Scheduled/sent timestamp
   - Error details if status is `failed`
   - Cancel button if status is `scheduled`

### Files changed
- `src/components/followups/FollowupDetailPanel.jsx` — add message detail dialog

