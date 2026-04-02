

## Add Detail Dialogs Across SMS, Email, Followup, Notification, and Communications

### Problem
Several list views in the app truncate content (SMS messages, email error details, scheduled communications, followup cards). Users can't read the full content without a detail dialog. The MemberFeed pattern (click to open a full-detail dialog) should be applied consistently.

### Changes

#### 1. SMS History — click to view full message detail
**File:** `src/components/sms/SMSHistoryDialog.jsx`
- Add a `selectedLog` state. Clicking an SMS log row opens a nested Dialog showing:
  - Full message text (no truncation, `whitespace-pre-wrap`)
  - Recipient phone, channel, type, status badge
  - Timestamps (created, delivery updated)
  - Full error message (if any) with trial account hint
  - Message SID if available

#### 2. Email Dashboard — click row to view full email detail
**File:** `src/pages/EmailDashboard.jsx`
- Add a `selectedEmail` state. Clicking a table row opens a Dialog showing:
  - Template name, recipient email
  - Status badge, timestamp
  - Full error message (untruncated)
  - Message ID and any metadata from the `metadata` JSON column
  - DLQ/retry info if present

#### 3. Followup list cards — click to view summary before opening detail panel
**File:** `src/pages/Followups.jsx`
- The followup list already opens `FollowupDetailPanel` on click, which is the full detail view. No additional dialog needed here — this is already implemented correctly.

#### 4. Scheduled Communications — click to view full message
**File:** `src/pages/Communications.jsx` (inside `ScheduledList` component)
- Add a `selectedScheduled` state. Clicking a scheduled item opens a Dialog showing:
  - Full message text (untruncated)
  - Subject (if email)
  - Channel, scheduled time
  - Filter/audience details from the `filters` JSON
  - Cancel button inside the dialog

#### 5. Announcement cards in Communications — click to view full content
**File:** `src/pages/Communications.jsx`
- Announcement cards currently truncate content. Add a `selectedAnnouncement` state. Clicking a card opens a Dialog showing:
  - Title, full content (whitespace-pre-wrap)
  - Audience, category, publish/expiry dates
  - Edit/Delete actions for admins

#### 6. Notification detail dialog — already implemented
The `NotificationBell.jsx` already has a detail dialog. No changes needed.

### Summary of files changed
- `src/components/sms/SMSHistoryDialog.jsx` — add SMS detail dialog
- `src/pages/EmailDashboard.jsx` — add email log detail dialog
- `src/pages/Communications.jsx` — add detail dialogs for scheduled items and announcement cards

### Technical approach
Each detail dialog follows the same pattern:
```jsx
const [selectedItem, setSelectedItem] = useState(null);

// In list: onClick={() => setSelectedItem(item)}
// At bottom of component:
<Dialog open={!!selectedItem} onOpenChange={(v) => !v && setSelectedItem(null)}>
  <DialogContent>
    <DialogHeader><DialogTitle>...</DialogTitle></DialogHeader>
    {/* Full untruncated content */}
  </DialogContent>
</Dialog>
```

All dialogs use `max-w-lg`, `whitespace-pre-wrap` for message bodies, and include relevant metadata badges and timestamps.

