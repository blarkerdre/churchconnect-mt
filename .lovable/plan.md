

## Display Full Message Dialog for Feed Items

### Problem
Currently, announcements and events in My Feed only expand inline with a small chevron, showing content in a compact space. The user wants to click on a feed item and see its full message and details in a proper dialog/sheet.

### Solution
Add a detail dialog that opens when the user taps on an announcement or event card (anywhere except the like button). The dialog shows the full content in a readable layout.

### Changes to `src/components/profile/MemberFeed.jsx`

#### 1. Announcement detail dialog
- Clicking the announcement card body (title or content area) opens a Dialog showing:
  - Title (large)
  - Publish date and audience badge
  - Full content text (no truncation, scrollable)
  - Like button at the bottom
- Marks as read on open

#### 2. Event detail dialog
- Clicking the event card body opens a Dialog showing:
  - Date badge, title (large)
  - Full description
  - Location, start/end time, event mode, audience — all displayed clearly
  - Registration button (if applicable)
  - Like button
- Marks as read on open

#### 3. Keep inline expand as-is
- The chevron still toggles inline preview for quick glances
- Clicking the title/card area opens the full dialog for deeper reading

### Implementation
- Import `Dialog, DialogContent, DialogHeader, DialogTitle` from UI components
- Add `selectedAnnouncement` and `selectedEvent` state to the parent `MemberFeed` component
- Pass an `onOpen` callback to each item; clicking the title/card sets the selected item and opens the dialog
- Two dialogs rendered at the bottom of the component: one for announcements, one for events
- Both dialogs include the like/react functionality inline

### Files changed
- `src/components/profile/MemberFeed.jsx` — add detail dialogs for announcements and events

